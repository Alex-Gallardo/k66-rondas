import type { DashboardMetrics } from "@/lib/admin/dashboard";

export function DashboardChart({
  daily,
}: {
  daily: DashboardMetrics["daily"];
}) {
  const visible = daily.slice(-14);
  const max = Math.max(
    1,
    ...visible.flatMap((day) => [day.visits, day.rounds]),
  );
  return (
    <section
      aria-label="Tendencia diaria"
      className="rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Actividad por día</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitas por fecha de registro y rondas por fecha de inicio, en hora
            local de la sede.
          </p>
        </div>
        <div className="flex gap-4 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" /> Visitas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-400" /> Rondas
          </span>
        </div>
      </div>
      {daily.length > 14 && (
        <p className="mt-2 text-xs text-muted-foreground">
          La gráfica muestra los últimos 14 días del rango; los indicadores y la
          tabla incluyen todo el período.
        </p>
      )}
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex min-w-max items-end gap-3">
          {visible.map((day) => (
            <div key={day.day} className="w-11 text-center">
              <div className="flex h-32 items-end justify-center gap-1 rounded-lg bg-secondary/60 px-1">
                <div
                  className="w-3 rounded-t bg-primary"
                  style={{
                    height: `${day.visits ? Math.max(5, (day.visits / max) * 100) : 0}%`,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="w-3 rounded-t bg-sky-400"
                  style={{
                    height: `${day.rounds ? Math.max(5, (day.rounds / max) * 100) : 0}%`,
                  }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {day.day.slice(5)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <details className="mt-4 rounded-xl border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Ver datos diarios del período
        </summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Fecha local</th>
                <th className="py-2">Visitas</th>
                <th className="py-2">Rondas iniciadas</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.day} className="border-b last:border-0">
                  <td className="py-2">{day.day}</td>
                  <td className="py-2 tabular-nums">{day.visits}</td>
                  <td className="py-2 tabular-nums">{day.rounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
