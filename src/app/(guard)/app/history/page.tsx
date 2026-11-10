import Link from "next/link";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export default async function GuardHistory() {
  const actor = await requireActor(["guard"]);
  const db = createAdminSupabase();
  const { data: visits, error } = await db
    .from("visits")
    .select(
      "id,checkpoint_name_snapshot,area_name_snapshot,recorded_at,note,geo_status,visit_photos(id)",
    )
    .eq("guard_id", actor.id)
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-20 pt-5 sm:px-6">
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-secondary"
      >
        <ArrowLeft className="size-5" /> Inicio
      </Link>
      <p className="mt-7 text-sm font-semibold text-primary">Tus registros</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Mi historial
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tus últimos 50 puntos, ordenados desde el más reciente.
      </p>
      {!visits?.length ? (
        <p className="mt-8 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Aún no has registrado puntos. Toca “Escanear QR” en el inicio para
          comenzar.
        </p>
      ) : (
        <div className="mt-7 space-y-3">
          {visits.map((visit) => (
            <article key={visit.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {visit.checkpoint_name_snapshot}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {visit.area_name_snapshot}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("es-GT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Guatemala",
                }).format(new Date(visit.recorded_at))}
              </p>
              {visit.note && (
                <p className="mt-3 rounded-xl bg-secondary p-3 text-sm">
                  📝 {visit.note}
                </p>
              )}
              {visit.visit_photos && (
                <a
                  href={`/api/visits/${visit.id}/photo`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                >
                  📷 Ver fotografía
                </a>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Ubicación del dispositivo:{" "}
                {visit.geo_status === "captured"
                  ? "capturada"
                  : "no disponible"}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
