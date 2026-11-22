import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
} from "lucide-react";
import { requireActor } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { VisitLocation } from "@/components/shared/visit-location";
import { guardPage, guardSecondary } from "@/components/guard/guard-ui";

export default async function GuardHistory() {
  const actor = await requireActor(["guard"]);
  const db = createAdminSupabase();
  const { data: visits, error } = await db
    .from("visits")
    .select(
      "id,checkpoint_name_snapshot,area_name_snapshot,recorded_at,note,geo_status,latitude,longitude,accuracy_m,client_ip,visit_photos(id),gates!visits_gate_id_fkey(sites(timezone))",
    )
    .eq("guard_id", actor.id)
    .order("recorded_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw error;

  const byDay = new Map<
    string,
    { visit: NonNullable<typeof visits>[number]; time: string }[]
  >();
  for (const visit of visits ?? []) {
    const date = new Date(visit.recorded_at);
    const timeZone = visit.gates?.sites?.timezone ?? "America/Guatemala";
    const day = new Intl.DateTimeFormat("es-GT", {
      dateStyle: "long",
      timeZone,
    }).format(date);
    const time = new Intl.DateTimeFormat("es-GT", {
      timeStyle: "short",
      timeZone,
    }).format(date);
    const bucket = byDay.get(day) ?? [];
    bucket.push({ visit, time });
    byDay.set(day, bucket);
  }

  return (
    <main className={`${guardPage} pb-10`}>
      <header className="flex items-center justify-between gap-3">
        <Link href="/app" className={guardSecondary}>
          <ArrowLeft className="size-5" aria-hidden="true" /> Inicio
        </Link>
        <strong className="text-sm tracking-tight">K66 Rondas</strong>
      </header>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Mi historial
      </h1>
      {!byDay.size ? (
        <section className="mt-4 rounded-2xl border bg-card p-5">
          <ClipboardList className="size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-2 font-semibold">
            Aún no tienes puntos registrados
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu primer punto aparecerá aquí después del escaneo.
          </p>
          <Link href="/app" className={`${guardSecondary} mt-2 border`}>
            Ir al inicio
          </Link>
        </section>
      ) : (
        <div className="mt-4 space-y-5">
          {Array.from(byDay, ([day, group]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {day}
              </h2>
              <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                {group.map(({ visit, time }) => (
                  <details key={visit.id} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-start gap-3 px-3 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">
                          {visit.checkpoint_name_snapshot}
                        </span>
                        <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                          {visit.area_name_snapshot}
                        </span>
                        {(visit.note?.trim() || visit.visit_photos) && (
                          <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-secondary-foreground">
                            {visit.note?.trim() && (
                              <span className="inline-flex items-center gap-1">
                                <FileText
                                  className="size-3"
                                  aria-hidden="true"
                                />{" "}
                                Observación
                              </span>
                            )}
                            {visit.visit_photos && (
                              <span className="inline-flex items-center gap-1">
                                <Camera className="size-3" aria-hidden="true" />{" "}
                                Foto
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <time
                        dateTime={visit.recorded_at}
                        className="shrink-0 text-xs font-medium text-muted-foreground"
                      >
                        {time}
                      </time>
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="mx-3 space-y-2 border-t pt-2 pb-3 sm:mx-4">
                      {visit.note?.trim() && (
                        <p className="break-words rounded-xl bg-secondary p-3 text-sm">
                          {visit.note}
                        </p>
                      )}
                      {visit.visit_photos && (
                        <a
                          href={`/api/visits/${visit.id}/photo`}
                          target="_blank"
                          rel="noreferrer"
                          className={`${guardSecondary} text-primary`}
                        >
                          <Camera className="size-4" aria-hidden="true" /> Ver
                          fotografía
                        </a>
                      )}
                      <VisitLocation
                        geoStatus={visit.geo_status}
                        latitude={visit.latitude}
                        longitude={visit.longitude}
                        accuracyM={visit.accuracy_m}
                        clientIp={visit.client_ip}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
