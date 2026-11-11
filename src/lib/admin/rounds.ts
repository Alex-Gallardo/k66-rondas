import "server-only";

import type { Actor } from "@/lib/auth";
import {
  getVisitScope,
  nextDate,
  zonedStart,
  type VisitScope,
} from "@/lib/admin/visits";

const roundColumns =
  "id,shift_id,guard_id,gate_id,status,started_at,ended_at,closure_reason,profiles!patrols_guard_id_fkey(full_name,employee_code),shifts!patrols_shift_id_fkey(gate_name_snapshot),gates!patrols_gate_id_fkey!inner(site_id,sites!inner(name,timezone))" as const;

export const ROUND_PAGE_SIZE = 25;
export type RoundStatus = "in_progress" | "completed" | "incomplete";
export type RoundFilters = {
  site: string;
  gate: string;
  guard: string;
  status: RoundStatus | "";
  from: string;
  to: string;
  page: number;
};
export const emptyRoundFilters: RoundFilters = {
  site: "",
  gate: "",
  guard: "",
  status: "",
  from: "",
  to: "",
  page: 1,
};

export async function getRoundScope(actor: Actor) {
  return getVisitScope(actor);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function parseRoundFilters(params: URLSearchParams): RoundFilters {
  const filters = {
    site: params.get("site") ?? "",
    gate: params.get("gate") ?? "",
    guard: params.get("guard") ?? "",
    status: params.get("status") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Number(params.get("page") ?? 1),
  };
  for (const key of ["site", "gate", "guard"] as const) {
    if (filters[key] && !/^[0-9a-f-]{36}$/i.test(filters[key]))
      throw new Error("Filtro de identificación inválido.");
  }
  if (
    filters.status &&
    !["in_progress", "completed", "incomplete"].includes(filters.status)
  )
    throw new Error("Estado de ronda inválido.");
  if (
    (filters.from && !validDate(filters.from)) ||
    (filters.to && !validDate(filters.to))
  )
    throw new Error("La fecha de filtro no es válida.");
  if (filters.from && filters.to && filters.from > filters.to)
    throw new Error("La fecha inicial debe ser anterior a la final.");
  if (
    !Number.isInteger(filters.page) ||
    filters.page < 1 ||
    filters.page > 10000
  )
    throw new Error("Página no válida.");
  return filters as RoundFilters;
}

export function roundSearchParams(filters: RoundFilters, page = filters.page) {
  const params = new URLSearchParams();
  for (const key of ["site", "gate", "guard", "status", "from", "to"] as const)
    if (filters[key]) params.set(key, filters[key]);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function resolveRoundSite(scope: VisitScope, filters: RoundFilters) {
  if (filters.site && !scope.sites.some((site) => site.id === filters.site))
    throw new Error("La sede no está disponible para tu cuenta.");
  const site =
    scope.sites.find((item) => item.id === filters.site) ??
    (scope.sites.length === 1 ? scope.sites[0] : null);
  if ((filters.from || filters.to) && !site)
    throw new Error("Selecciona una sede para filtrar por fecha local.");
  return site;
}

export async function getRoundGuards(scope: VisitScope) {
  const { db, allowedGateIds } = scope;
  let ids: string[] | null = null;
  if (allowedGateIds) {
    if (!allowedGateIds.length) return [];
    const assignments = await db
      .from("gate_assignments")
      .select("profile_id")
      .in("gate_id", allowedGateIds);
    if (assignments.error) throw assignments.error;
    ids = [...new Set((assignments.data ?? []).map((item) => item.profile_id))];
    if (!ids.length) return [];
  }
  let query = db
    .from("profiles")
    .select("id,full_name,employee_code")
    .eq("role", "guard")
    .order("full_name")
    .limit(1000);
  if (ids) query = query.in("id", ids);
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}

function roundQuery(scope: VisitScope, filters: RoundFilters) {
  const site = resolveRoundSite(scope, filters);
  let query = scope.db
    .from("patrols")
    .select(roundColumns, { count: "exact" })
    .order("started_at", { ascending: false })
    .order("id", { ascending: false });
  if (scope.allowedGateIds) {
    if (!scope.allowedGateIds.length)
      return query.eq("id", "00000000-0000-0000-0000-000000000000");
    query = query.in("gate_id", scope.allowedGateIds);
  }
  if (site) query = query.eq("gates.site_id", site.id);
  if (filters.gate) query = query.eq("gate_id", filters.gate);
  if (filters.guard) query = query.eq("guard_id", filters.guard);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from && site)
    query = query.gte("started_at", zonedStart(filters.from, site.timezone));
  if (filters.to && site)
    query = query.lt(
      "started_at",
      zonedStart(nextDate(filters.to), site.timezone),
    );
  return query;
}

const zeroProgress = {
  expected_total: 0,
  visited_total: 0,
  required_total: 0,
  required_visited: 0,
};

export async function getRoundPage(scope: VisitScope, filters: RoundFilters) {
  const first = (filters.page - 1) * ROUND_PAGE_SIZE;
  const { data, count, error } = await roundQuery(scope, filters).range(
    first,
    first + ROUND_PAGE_SIZE - 1,
  );
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return { rounds: [], total: count ?? 0 };
  const progress = await scope.db
    .from("patrol_progress")
    .select(
      "patrol_id,expected_total,visited_total,required_total,required_visited",
    )
    .in(
      "patrol_id",
      rows.map((row) => row.id),
    );
  if (progress.error) throw progress.error;
  const byId = new Map(
    (progress.data ?? []).map((item) => [item.patrol_id, item]),
  );
  return {
    rounds: rows.map((row) => ({
      ...row,
      progress: byId.get(row.id) ?? zeroProgress,
    })),
    total: count ?? 0,
  };
}

export async function getRoundById(scope: VisitScope, id: string) {
  let query = scope.db.from("patrols").select(roundColumns).eq("id", id);
  if (scope.allowedGateIds) {
    if (!scope.allowedGateIds.length) return null;
    query = query.in("gate_id", scope.allowedGateIds);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const progress = await scope.db
    .from("patrol_progress")
    .select(
      "patrol_id,expected_total,visited_total,required_total,required_visited",
    )
    .eq("patrol_id", id)
    .maybeSingle();
  if (progress.error) throw progress.error;
  return { ...data, progress: progress.data ?? zeroProgress };
}

export async function getRoundPoints(scope: VisitScope, id: string) {
  const expected = [] as {
    checkpoint_id: string;
    position: number;
    required: boolean;
    checkpoint_name_snapshot: string;
    area_name_snapshot: string;
  }[];
  for (let offset = 0; ; offset += 500) {
    const result = await scope.db
      .from("patrol_expected_points")
      .select(
        "checkpoint_id,position,required,checkpoint_name_snapshot,area_name_snapshot",
      )
      .eq("patrol_id", id)
      .order("position")
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    expected.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) break;
  }
  const visits = [] as {
    id: string;
    checkpoint_id: string;
    recorded_at: string;
  }[];
  for (let offset = 0; ; offset += 500) {
    const result = await scope.db
      .from("visits")
      .select("id,checkpoint_id,recorded_at")
      .eq("patrol_id", id)
      .order("recorded_at")
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    visits.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) break;
  }
  const byPoint = new Map(visits.map((visit) => [visit.checkpoint_id, visit]));
  return expected.map((point) => ({
    ...point,
    visit: byPoint.get(point.checkpoint_id) ?? null,
  }));
}

export function roundDuration(startedAt: string, endedAt: string | null) {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const minutes = Math.max(
    0,
    Math.floor((end - new Date(startedAt).getTime()) / 60_000),
  );
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
