"use client";

import { useState } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type SitePolicy = {
  id: string;
  name: string;
  active: boolean;
  geo_enabled: boolean;
  idle_logout_minutes: number;
  photo_retention_days: number;
};

export function SiteSettingsManager({ sites }: { sites: SitePolicy[] }) {
  const [items, setItems] = useState(sites);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggle(site: SitePolicy) {
    setPending(site.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: site.id,
          geo_enabled: !site.geo_enabled,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "No pudimos guardar el cambio.");
      setItems((current) =>
        current.map((item) =>
          item.id === site.id
            ? { ...item, geo_enabled: data.geo_enabled }
            : item,
        ),
      );
      setMessage(`Política GPS de ${site.name} actualizada.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar el cambio.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Define si la app solicita coordenadas GPS al registrar puntos de cada
          sede.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-4 text-sm text-primary"
        >
          ✅ {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {items.length === 0 && (
        <p className="rounded-2xl border bg-card p-6">
          Crea una sede para configurar sus políticas.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((site) => (
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4">
              <div>
                <p className="font-semibold">Coordenadas GPS</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {site.geo_enabled
                    ? "La app solicitará GPS en nuevos escaneos."
                    : "Los nuevos escaneos se guardarán sin GPS. La IP se conserva."}
                </p>
              </div>
              <Button
                type="button"
                variant={site.geo_enabled ? "outline" : "default"}
                disabled={pending !== null || !site.active}
                aria-label={`${site.geo_enabled ? "Desactivar" : "Activar"} GPS para ${site.name}`}
                onClick={() => void toggle(site)}
              >
                {pending === site.id
                  ? "Guardando…"
                  : site.geo_enabled
                    ? "Desactivar GPS"
                    : "Activar GPS"}
              </Button>
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                El cambio queda registrado en auditoría. Los registros
                existentes conservan su ubicación.
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
