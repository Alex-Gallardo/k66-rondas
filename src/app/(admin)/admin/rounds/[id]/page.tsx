import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { requireActor } from "@/lib/auth";
import { formatVisitTime } from "@/lib/admin/visits";
import {
  getRoundById,
  getRoundPoints,
  getRoundScope,
  roundDuration,
} from "@/lib/admin/rounds";
import { RoundStatus } from "@/components/admin/round-status";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor(["admin", "supervisor"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const scope = await getRoundScope(actor);
  const round = await getRoundById(scope, id);
  if (!round) notFound();
  const points = await getRoundPoints(scope, id);
  const zone = round.gates.sites.timezone;
  const missingRequired = Math.max(
    0,
    (round.progress.required_total ?? 0) -
      (round.progress.required_visited ?? 0),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/rounds"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-4" /> Rondas
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary">Detalle de ronda</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {round.shifts.gate_name_snapshot}
          </h1>
          <RoundStatus status={round.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {round.gates.sites.name} · {round.profiles.full_name} ·{" "}
          {round.profiles.employee_code}
        </p>
      </header>

      <section
        aria-label="Resumen de ronda"
        className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 sm:p-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Inicio
          </p>
          <p className="mt-1 font-medium">
            {formatVisitTime(round.started_at, zone)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Fin
          </p>
          <p className="mt-1 font-medium">
            {round.ended_at
              ? formatVisitTime(round.ended_at, zone)
              : "En curso"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {round.ended_at ? "Duración" : "Transcurrido al cargar"}
          </p>
          <p className="mt-1 flex items-center gap-2 font-medium">
            <Clock3 className="size-4 text-primary" />
            {roundDuration(round.started_at, round.ended_at)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Zona horaria
          </p>
          <p className="mt-1 font-medium">{zone}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Todos los puntos
          </p>
          <p className="mt-1 text-xl font-semibold">
            {round.progress.visited_total}/{round.progress.expected_total}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Puntos obligatorios
          </p>
          <p className="mt-1 text-xl font-semibold">
            {round.progress.required_visited}/{round.progress.required_total}
          </p>
        </div>
      </section>

      {round.status === "incomplete" && (
        <section
          aria-label="Cierre incompleto"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-5" /> Ronda cerrada incompleta
          </h2>
          <p className="mt-2 text-sm">
            {missingRequired}{" "}
            {missingRequired === 1
              ? "punto obligatorio pendiente"
              : "puntos obligatorios pendientes"}
            .
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            <strong>Motivo:</strong>{" "}
            {round.closure_reason ?? "Sin motivo registrado"}
          </p>
        </section>
      )}

      <section
        aria-label="Puntos de la ronda"
        className="rounded-2xl border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Recorrido esperado</h2>
          <p className="text-xs text-muted-foreground">
            Orden y nombres guardados al iniciar
          </p>
        </div>
        <ol className="mt-5 divide-y">
          {points.map((point) => (
            <li key={point.checkpoint_id} className="flex gap-3 py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {point.position}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {point.checkpoint_name_snapshot}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {point.required ? "Obligatorio" : "Opcional"}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {point.area_name_snapshot}
                </p>
                {point.visit ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-emerald-800">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-4" /> Visitado{" "}
                      {formatVisitTime(point.visit.recorded_at, zone)}
                    </span>
                    <Link
                      href={`/admin/visits/${point.visit.id}`}
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                    >
                      Ver registro y ubicación →
                    </Link>
                  </div>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Circle className="size-4" />{" "}
                    {point.required
                      ? "Obligatorio pendiente"
                      : "Opcional pendiente"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
