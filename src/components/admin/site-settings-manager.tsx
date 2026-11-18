import { MapPin, ShieldCheck } from "lucide-react";

type SitePolicy = {
  id: string;
  name: string;
  active: boolean;
  idle_logout_minutes: number;
  photo_retention_days: number;
};

export function SiteSettingsManager({ sites }: { sites: SitePolicy[] }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La ubicación GPS es obligatoria para guardar cada punto QR nuevo.
        </p>
      </header>
      {sites.length === 0 && (
        <p className="rounded-2xl border bg-card p-6">
          Crea una sede para configurar sus políticas.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {sites.map((site) => (
          <section
            key={site.id}
            className="rounded-2xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{site.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {site.active ? "Sede activa" : "Sede archivada"}
                </p>
              </div>
              <MapPin className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 rounded-xl bg-secondary p-4">
              <div>
                <p className="font-semibold">GPS obligatorio</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Si el dispositivo no entrega coordenadas, el punto no se
                  registra. La IP se conserva como dato de red adicional.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                Los registros anteriores conservan su estado de ubicación
                original.
              </p>
            </div>
          </section>
        ))}
      </div>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Políticas previstas</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La base guarda 30 minutos de inactividad y 90 días de retención de
          fotos por defecto. La aplicación aún no ejecuta estas dos políticas;
          se activarán cuando se implemente el cierre por inactividad y la
          limpieza programada.
        </p>
      </section>
    </div>
  );
}
