import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assignedGateIds, requireActor } from "@/lib/auth";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";
import {
  PatrolSchedules,
  type ScheduleGate,
  type ScheduleGuard,
  type ScheduleRule,
  type ScheduleTemplate,
} from "@/components/admin/patrol-schedules";
import { occurrenceColumns, type Occurrence } from "@/lib/notifications/data";

export default async function RoundSchedulePage() {
  const actor = await requireActor(["admin", "supervisor"]);
  const editable = actor.role === "admin";
  const scope = editable ? null : await assignedGateIds(actor);
  const db = createAdminSupabaseUntyped();
  const checkedAt = Date.now();
  let agenda = db
    .from("patrol_occurrences")
    .select(occurrenceColumns)
    .gte("scheduled_at", new Date(checkedAt - 3 * 86400000).toISOString())
    .order("scheduled_at")
    .order("id")
    .limit(200);
  if (scope)
    agenda = agenda.in(
      "gate_id",
      scope.length ? scope : ["00000000-0000-0000-0000-000000000000"],
    );
  const [occurrences, rules, gates, templates, guards, assignments, metrics] =
    await Promise.all([
      agenda,
      editable
        ? db
            .from("patrol_schedules")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200)
        : null,
      editable
        ? db
            .from("gates")
            .select("id,name,sites!inner(name,timezone)")
            .eq("active", true)
            .eq("sites.active", true)
            .order("name")
        : null,
      editable
        ? db
            .from("patrol_templates")
            .select("id,name,gate_id")
            .eq("active", true)
            .order("name")
        : null,
      editable
        ? db
            .from("profiles")
            .select("id,full_name,employee_code")
            .eq("role", "guard")
            .eq("active", true)
            .eq("must_change_password", false)
            .order("full_name")
        : null,
      editable
        ? db
            .from("gate_assignments")
            .select("gate_id,profile_id")
            .eq("active", true)
        : null,
      editable ? db.rpc("patrol_notification_metrics") : null,
    ]);
  if (
    [occurrences, rules, gates, templates, guards, assignments].some(
      (result) => result?.error,
    )
  )
    throw new Error("No pudimos cargar la programación de rondas.");
  const gateIdsByGuard = new Map<string, string[]>();
  for (const assignment of assignments?.data ?? []) {
    const gateIds = gateIdsByGuard.get(assignment.profile_id) ?? [];
    gateIds.push(assignment.gate_id);
    gateIdsByGuard.set(assignment.profile_id, gateIds);
  }
  const guardOptions = (guards?.data ?? []).map((guard) => ({
    ...guard,
    gateIds: gateIdsByGuard.get(guard.id) ?? [],
  })) as ScheduleGuard[];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/rounds"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Rondas
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Programación</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Agenda por garita en la hora local de la sede.
        </p>
      </header>
      {metrics?.data && !metrics.error && (
        <section
          aria-label="Estado de entrega"
          className="rounded-2xl border bg-card p-4"
        >
          <h2 className="font-semibold">Avisos Push</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Resultados de los últimos 7 días y cola actual.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Aceptados por proveedor", metrics.data.accepted],
              ["En cola", metrics.data.queued],
              ["Fallidos", metrics.data.failed],
              ["Suscripciones caducadas", metrics.data.ended_subscriptions],
              [
                "Tiempo p95",
                metrics.data.p95_seconds == null
                  ? "—"
                  : `${metrics.data.p95_seconds} s`,
              ],
              [
                "Aviso más antiguo en cola",
                metrics.data.oldest_seconds == null
                  ? "—"
                  : `${metrics.data.oldest_seconds} s`,
              ],
              [
                "Guardias con dispositivo",
                `${metrics.data.enabled_guards}/${metrics.data.assigned_guards}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <PatrolSchedules
        editable={editable}
        checkedAt={checkedAt}
        rules={(rules?.data ?? []) as ScheduleRule[]}
        gates={(gates?.data ?? []) as unknown as ScheduleGate[]}
        templates={(templates?.data ?? []) as ScheduleTemplate[]}
        guards={guardOptions}
        occurrences={occurrences.data as unknown as Occurrence[]}
      />
    </div>
  );
}
