import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, ClipboardList } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { formatVisitTime, getVisitById, getVisitScope } from "@/lib/admin/visits";
import { VisitLocation } from "@/components/shared/visit-location";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(["admin", "supervisor"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const visit = await getVisitById(await getVisitScope(actor), id);
  if (!visit) notFound();
  const timezone = visit.gates.sites.timezone;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/visits" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Registros</Link>
      <header><p className="text-sm font-semibold text-primary">Detalle de visita</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{visit.checkpoint_name_snapshot}</h1>
        <p className="mt-2 text-muted-foreground">{visit.area_name_snapshot} · {formatVisitTime(visit.recorded_at, timezone)}</p></header>
      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 sm:p-6" aria-label="Datos del registro">
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Guardia</p><p className="mt-1 font-medium">{visit.profiles.full_name}</p><p className="text-sm text-muted-foreground">{visit.profiles.employee_code}</p></div>
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Sede y garita</p><p className="mt-1 font-medium">{visit.gates.sites.name}</p><p className="text-sm text-muted-foreground">{visit.gates.name}</p></div>
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Fecha y hora del servidor</p><p className="mt-1 font-medium">{formatVisitTime(visit.recorded_at, timezone)}</p><p className="text-xs text-muted-foreground">Zona: {timezone}</p></div>
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Identificador</p><p className="mt-1 break-all font-mono text-xs">{visit.id}</p></div>
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-label="Ubicación registrada">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><ClipboardList className="size-5 text-primary" /> Ubicación al registrar</h2>
        <VisitLocation geoStatus={visit.geo_status} latitude={visit.latitude} longitude={visit.longitude} accuracyM={visit.accuracy_m} clientIp={visit.client_ip} />
        {visit.geo_captured_at && <p className="mt-3 text-xs text-muted-foreground">GPS obtenido: {formatVisitTime(visit.geo_captured_at, timezone)}</p>}
        <p className="mt-4 text-xs text-muted-foreground">La IP identifica la conexión de red; las coordenadas GPS provienen del permiso de ubicación del dispositivo.</p>
      </section>
      {(visit.note || visit.visit_photos) && <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-label="Evidencia">
        <h2 className="text-lg font-semibold">Evidencia</h2>
        {visit.note && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-secondary p-4 text-sm">{visit.note}</p>}
        {visit.visit_photos && <a href={`/api/visits/${visit.id}/photo`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"><Camera className="size-4" /> Ver fotografía</a>}
      </section>}
    </div>
  );
}
