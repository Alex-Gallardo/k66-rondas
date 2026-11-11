import "server-only";

import type { Actor } from "@/lib/auth";
import { assignedGateIds } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

const visitColumns =
  "id,patrol_id,checkpoint_id,guard_id,gate_id,recorded_at,checkpoint_name_snapshot,area_name_snapshot,note,geo_status,latitude,longitude,accuracy_m,geo_captured_at,client_ip,visit_photos(id),profiles!visits_guard_id_fkey(full_name,employee_code),gates!visits_gate_id_fkey!inner(name,site_id,sites!inner(name,timezone))" as const;

export const VISIT_PAGE_SIZE = 25;
export const emptyVisitFilters = {
  site: "",
  gate: "",
  guard: "",
  point: "",
  from: "",
  to: "",
  page: 1,
};
export type VisitFilters = {
  site: string;
  gate: string;
  guard: string;
  point: string;
  from: string;
  to: string;
  page: number;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function parseVisitFilters(params: URLSearchParams): VisitFilters {
  const filters = {
    site: params.get("site") ?? "",
    gate: params.get("gate") ?? "",
    guard: params.get("guard") ?? "",
    point: params.get("point") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Number(params.get("page") ?? 1),
  };
  for (const key of ["site", "gate", "guard", "point"] as const) {
    if (filters[key] && !/^[0-9a-f-]{36}$/i.test(filters[key]))
      throw new Error("Filtro de identificación inválido.");
  }
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
  return filters;
}

export function visitSearchParams(filters: VisitFilters, page = filters.page) {
  const params = new URLSearchParams();
  for (const key of ["site", "gate", "guard", "point", "from", "to"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (page > 1) params.set("page", String(page));
  return params;
}

export async function getVisitScope(actor: Actor) {
  const db = createAdminSupabase();
  const allowedGateIds =
    actor.role === "supervisor" ? await assignedGateIds(actor) : null;
  let gates: { id: string; name: string; site_id: string }[] = [];
  if (!allowedGateIds || allowedGateIds.length) {
    let query = db.from("gates").select("id,name,site_id").order("name");
    if (allowedGateIds) query = query.in("id", allowedGateIds);
    const result = await query;
    if (result.error) throw result.error;
    gates = result.data ?? [];
  }
  const siteIds = [...new Set(gates.map((gate) => gate.site_id))];
  let sites: { id: string; name: string; timezone: string }[] = [];
  if (siteIds.length) {
    const result = await db
      .from("sites")
      .select("id,name,timezone")
      .in("id", siteIds)
      .order("name");
    if (result.error) throw result.error;
    sites = result.data ?? [];
  }
  return { actor, db, allowedGateIds, gates, sites };
}

export type VisitScope = Awaited<ReturnType<typeof getVisitScope>>;

export async function getVisitOptions(scope: VisitScope) {
  const { db, allowedGateIds, sites } = scope;
  let guardIds: string[] | null = null;
  if (allowedGateIds) {
    if (!allowedGateIds.length) return { guards: [], points: [] };
    const assignments = await db
      .from("gate_assignments")
      .select("profile_id")
      .in("gate_id", allowedGateIds)
      .eq("active", true);
    if (assignments.error) throw assignments.error;
    guardIds = [
      ...new Set((assignments.data ?? []).map((item) => item.profile_id)),
    ];
  }
  let guards: { id: string; full_name: string; employee_code: string }[] = [];
  if (!guardIds || guardIds.length) {
    let query = db
      .from("profiles")
      .select("id,full_name,employee_code")
      .eq("role", "guard")
      .order("full_name")
      .limit(1000);
    if (guardIds) query = query.in("id", guardIds);
    const result = await query;
    if (result.error) throw result.error;
    guards = result.data ?? [];
  }
  let points: { id: string; name: string; code: string }[] = [];
  if (sites.length) {
    const result = await db
      .from("checkpoints")
      .select("id,name,code,areas!inner(site_id)")
      .in(
        "areas.site_id",
        sites.map((site) => site.id),
      )
      .order("name")
      .limit(1000);
    if (result.error) throw result.error;
    points = (result.data ?? []).map(({ id, name, code }) => ({
      id,
      name,
      code,
    }));
  }
  return { guards, points };
}

function zonedStart(date: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .map((part) => [part.type, part.value]),
    );
    const wall = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    guess += target - wall;
  }
  return new Date(guess).toISOString();
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function resolveVisitSite(scope: VisitScope, filters: VisitFilters) {
  if (filters.site && !scope.sites.some((site) => site.id === filters.site))
    throw new Error("La sede no está disponible para tu cuenta.");
  const site =
    scope.sites.find((item) => item.id === filters.site) ??
    (scope.sites.length === 1 ? scope.sites[0] : null);
  if ((filters.from || filters.to) && !site)
    throw new Error("Selecciona una sede para filtrar por fecha local.");
  return site;
}

export function visitQuery(
  scope: VisitScope,
  filters: VisitFilters,
  site = resolveVisitSite(scope, filters),
) {
  let query = scope.db
    .from("visits")
    .select(visitColumns, { count: "exact" })
    .order("recorded_at", { ascending: false })
    .order("id", { ascending: false });
  if (scope.allowedGateIds) {
    if (!scope.allowedGateIds.length)
      return query.eq("id", "00000000-0000-0000-0000-000000000000");
    query = query.in("gate_id", scope.allowedGateIds);
  }
  if (site) query = query.eq("gates.site_id", site.id);
  if (filters.gate) query = query.eq("gate_id", filters.gate);
  if (filters.guard) query = query.eq("guard_id", filters.guard);
  if (filters.point) query = query.eq("checkpoint_id", filters.point);
  if (filters.from && site)
    query = query.gte("recorded_at", zonedStart(filters.from, site.timezone));
  if (filters.to && site)
    query = query.lt(
      "recorded_at",
      zonedStart(nextDate(filters.to), site.timezone),
    );
  return query;
}

export async function getVisitPage(scope: VisitScope, filters: VisitFilters) {
  const first = (filters.page - 1) * VISIT_PAGE_SIZE;
  const { data, count, error } = await visitQuery(scope, filters).range(
    first,
    first + VISIT_PAGE_SIZE - 1,
  );
  if (error) throw error;
  return { visits: data ?? [], total: count ?? 0 };
}

export async function getVisitById(scope: VisitScope, id: string) {
  let query = scope.db.from("visits").select(visitColumns).eq("id", id);
  if (scope.allowedGateIds) {
    if (!scope.allowedGateIds.length) return null;
    query = query.in("gate_id", scope.allowedGateIds);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export function formatVisitTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
