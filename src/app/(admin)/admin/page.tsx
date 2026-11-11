import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Route,
  TriangleAlert,
  Users,
} from "lucide-react";
import { requireActor } from "@/lib/auth";
import {
  getDashboardMetrics,
  getDashboardScope,
  parseDashboardFilters,
  percentage,
  type DashboardMetrics,
} from "@/lib/admin/dashboard";
import { DashboardChart } from "@/components/admin/dashboard-chart";

type Search = Record<string, string | string[] | undefined>;

function fromSearch(raw: Search) {
  const params = new URLSearchParams();
  for (const key of ["site", "gate", "from", "to"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  href,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {href && (
          <ArrowRight
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </>
  );
  const className =
    "rounded-2xl border bg-card p-5 focus-visible:outline-2 focus-visible:outline-primary";
  return href ? (
    <Link
      href={href}
      className={`${className} transition-shadow hover:shadow-md`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DashboardMetricsView({
  metrics,
  siteId,
  gate,
  from,
  to,
}: {
  metrics: DashboardMetrics;
  siteId: string;
  gate: string;
  from: string;
  to: string;
}) {
  const params = new URLSearchParams({ site: siteId, from, to });
  if (gate) params.set("gate", gate);
  const visitsUrl = `/admin/visits?${params}`;
  const roundsUrl = `/admin/rounds?${params}`;
  const completedParams = new URLSearchParams(params);
  completedParams.set("status", "completed");
  const incompleteParams = new URLSearchParams(params);
  incompleteParams.set("status", "incomplete");
  return (
    <div className="space-y-7">
      <section
        aria-label="Indicadores del período"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title="Visitas registradas"
          value={metrics.visits}
          detail="Escaneos confirmados en el período."
          icon={MapPin}
          href={visitsUrl}
        />
        <MetricCard
          title="Rondas iniciadas"
          value={metrics.rounds_started}
          detail="Base de los indicadores de estado y cobertura."
          icon={Route}
          href={roundsUrl}
        />
        <MetricCard
          title="Rondas completadas"
          value={percentage(metrics.rounds_completed, metrics.rounds_started)}
          detail={`${metrics.rounds_completed} de ${metrics.rounds_started} iniciadas.`}
          icon={CheckCircle2}
          href={`/admin/rounds?${completedParams}`}
        />
        <MetricCard
          title="Rondas incompletas"
          value={metrics.rounds_incomplete}
          detail={`${metrics.rounds_incomplete} de ${metrics.rounds_started} iniciadas; revisa el motivo.`}
          icon={TriangleAlert}
          href={`/admin/rounds?${incompleteParams}`}
        />
        <MetricCard
          title="Cobertura obligatoria"
          value={percentage(
            metrics.required_visited,
            metrics.required_expected,
          )}
          detail={`${metrics.required_visited} de ${metrics.required_expected} puntos obligatorios de rondas iniciadas.`}
          icon={Activity}
        />
        <MetricCard
          title="GPS disponible"
          value={percentage(metrics.geo_captured, metrics.visits)}
          detail={`${metrics.geo_captured} de ${metrics.visits} visitas con coordenadas del dispositivo.`}
          icon={MapPin}
        />
        <MetricCard
          title="Duración mediana / p90"
          value={
            metrics.duration_median_minutes === null
              ? "—"
              : `${metrics.duration_median_minutes} / ${metrics.duration_p90_minutes} min`
          }
          detail={`Solo rondas completadas: ${metrics.rounds_completed} de ${metrics.rounds_started} iniciadas.`}
          icon={Clock3}
        />
        <MetricCard
          title="Adopción de guardias"
          value={percentage(metrics.active_guards, metrics.assigned_guards)}
          detail={`${metrics.active_guards} de ${metrics.assigned_guards} guardias actualmente asignados iniciaron turno.`}
          icon={Users}
        />
      </section>
      <DashboardChart daily={metrics.daily} />
      <section
        aria-label="Estado y límites de medición"
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Estado de las rondas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {metrics.rounds_completed} completadas · {metrics.rounds_incomplete}{" "}
            incompletas · {metrics.rounds_in_progress} en curso, de{" "}
            {metrics.rounds_started} iniciadas.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Métricas aún sin medición</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            El tiempo desde tocar «Escanear QR» hasta confirmar y la tasa de
            guardado requieren registrar todos los intentos del dispositivo,
            incluidos errores de red. No se estiman con las visitas guardadas.
          </p>
        </div>
      </section>
    </div>
  );
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await requireActor(["admin", "supervisor"]);
  const scope = await getDashboardScope(actor);
  let parsed: ReturnType<typeof parseDashboardFilters>;
  let filterError = "";
  try {
    parsed = parseDashboardFilters(scope, fromSearch(await searchParams));
  } catch (cause) {
    filterError =
      cause instanceof Error ? cause.message : "Revisa los filtros.";
    parsed = parseDashboardFilters(scope, new URLSearchParams());
  }
  const { site, filters } = parsed;
  const metrics =
    site && !filterError
      ? await getDashboardMetrics(scope, site, filters)
      : null;
  const gates = scope.gates.filter((gate) => gate.site_id === site?.id);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-primary">
          {actor.role === "admin"
            ? "Panel de administración"
            : "Panel de supervisor"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Resumen de operación
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Visitas y rondas registradas en el período. Los datos se agrupan en la
          zona horaria de la sede.
        </p>
      </header>

      {!site ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Sin garitas disponibles</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor.role === "admin"
              ? "Crea una sede y una garita para comenzar a medir la operación."
              : "Solicita al administrador que te asigne una garita."}
          </p>
          {actor.role === "admin" && (
            <Link
              href="/admin/sites"
              className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary"
            >
              Configurar sede →
            </Link>
          )}
        </section>
      ) : (
        <>
          <form method="get" className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Período y alcance</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm font-medium">
                <span className="block">Sede</span>
                <select
                  name="site"
                  defaultValue={site.id}
                  className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
                >
                  {scope.sites.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span className="block">Garita</span>
                <select
                  name="gate"
                  defaultValue={filters.gate}
                  className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
                >
                  <option value="">Todas las garitas</option>
                  {gates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span className="block">Desde</span>
                <input
                  name="from"
                  type="date"
                  defaultValue={filters.from}
                  className="min-h-11 w-full rounded-xl border bg-card px-3"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span className="block">Hasta</span>
                <input
                  name="to"
                  type="date"
                  defaultValue={filters.to}
                  className="min-h-11 w-full rounded-xl border bg-card px-3"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Rango máximo: 90 días. Las rondas se cuentan por inicio y las
              visitas por registro, ambos en hora local de {site.name}.
            </p>
            <button
              type="submit"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Aplicar filtros
            </button>
          </form>
          {filterError && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-red-50 p-4 text-sm text-destructive"
            >
              {filterError}
            </p>
          )}
          {metrics && (
            <DashboardMetricsView
              metrics={metrics}
              siteId={site.id}
              gate={filters.gate}
              from={filters.from}
              to={filters.to}
            />
          )}
        </>
      )}
      {actor.role === "admin" && (
        <section className="rounded-2xl border bg-secondary p-5">
          <h2 className="font-semibold">Configurar la planta</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-primary">
            <Link
              href="/admin/users"
              className="inline-flex min-h-11 items-center"
            >
              Usuarios →
            </Link>
            <Link
              href="/admin/checkpoints"
              className="inline-flex min-h-11 items-center"
            >
              Puntos QR →
            </Link>
            <Link
              href="/admin/templates"
              className="inline-flex min-h-11 items-center"
            >
              Plantillas →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
