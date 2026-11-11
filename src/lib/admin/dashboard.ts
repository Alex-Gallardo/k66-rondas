import "server-only";

import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { getVisitScope, nextDate, zonedStart } from "@/lib/admin/visits";

const dailySchema = z.object({
  day: z.string(),
  visits: z.number().int().nonnegative(),
  rounds: z.number().int().nonnegative(),
});
const metricsSchema = z.object({
  visits: z.number().int().nonnegative(),
  geo_captured: z.number().int().nonnegative(),
  rounds_started: z.number().int().nonnegative(),
  rounds_completed: z.number().int().nonnegative(),
  rounds_incomplete: z.number().int().nonnegative(),
  rounds_in_progress: z.number().int().nonnegative(),
  required_expected: z.number().int().nonnegative(),
  required_visited: z.number().int().nonnegative(),
  duration_median_minutes: z.number().nonnegative().nullable(),
  duration_p90_minutes: z.number().nonnegative().nullable(),
  assigned_guards: z.number().int().nonnegative(),
  active_guards: z.number().int().nonnegative(),
  daily: z.array(dailySchema),
});

export type DashboardMetrics = z.infer<typeof metricsSchema>;
export type DashboardFilters = {
  site: string;
  gate: string;
  from: string;
  to: string;
};

function localDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export async function getDashboardScope(actor: Actor) {
  const scope = await getVisitScope(actor);
  if (actor.role === "admin") {
    const result = await scope.db
      .from("sites")
      .select("id,name,timezone")
      .order("name");
    if (result.error) throw result.error;
    return { ...scope, sites: result.data ?? [] };
  }
  return scope;
}

export function parseDashboardFilters(
  scope: Awaited<ReturnType<typeof getDashboardScope>>,
  params: URLSearchParams,
) {
  const requestedSite = params.get("site") ?? "";
  const site = requestedSite
    ? scope.sites.find((item) => item.id === requestedSite)
    : scope.sites[0];
  if (requestedSite && !site)
    throw new Error("La sede no está disponible para tu cuenta.");
  const gate = params.get("gate") ?? "";
  if (
    gate &&
    !scope.gates.some((item) => item.id === gate && item.site_id === site?.id)
  )
    throw new Error("La garita no está disponible en esta sede.");
  const today = localDate(new Date(), site?.timezone ?? "America/Guatemala");
  const from = params.get("from") ?? moveDate(today, -6);
  const to = params.get("to") ?? today;
  if (!validDate(from) || !validDate(to) || from > to)
    throw new Error("Revisa el rango de fechas.");
  const days =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (days > 90) throw new Error("Elige un rango de hasta 90 días.");
  return {
    site,
    filters: {
      site: site?.id ?? "",
      gate,
      from,
      to,
    } satisfies DashboardFilters,
  };
}

export async function getDashboardMetrics(
  scope: Awaited<ReturnType<typeof getDashboardScope>>,
  site: NonNullable<ReturnType<typeof parseDashboardFilters>["site"]>,
  filters: DashboardFilters,
) {
  const gates = scope.gates
    .filter(
      (item) =>
        item.site_id === site.id && (!filters.gate || item.id === filters.gate),
    )
    .map((item) => item.id);
  const result = await scope.db.rpc("dashboard_metrics", {
    p_site_id: site.id,
    p_gate_ids: gates,
    p_from_utc: zonedStart(filters.from, site.timezone),
    p_to_utc: zonedStart(nextDate(filters.to), site.timezone),
    p_from_date: filters.from,
    p_to_date: filters.to,
  });
  if (result.error) throw result.error;
  return metricsSchema.parse(result.data);
}

export function percentage(part: number, total: number) {
  return total ? `${((part / total) * 100).toFixed(1)}%` : "—";
}
