import Link from "next/link";
import { Download, Filter, MapPin } from "lucide-react";
import { requireActor } from "@/lib/auth";
import {
  emptyVisitFilters,
  formatVisitTime,
  getVisitOptions,
  getVisitPage,
  getVisitScope,
  parseVisitFilters,
  resolveVisitSite,
  VISIT_PAGE_SIZE,
  visitSearchParams,
  type VisitFilters,
} from "@/lib/admin/visits";
import { VisitLocation } from "@/components/shared/visit-location";

type Search = Record<string, string | string[] | undefined>;

function fromSearch(raw: Search) {
  const params = new URLSearchParams();
  for (const key of ["site", "gate", "guard", "point", "from", "to", "page"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

function SelectFilter({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span className="block">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await requireActor(["admin", "supervisor"]);
  const scope = await getVisitScope(actor);
  const options = await getVisitOptions(scope);
  let filters: VisitFilters = { ...emptyVisitFilters };
  let filterError = "";
  try {
    filters = parseVisitFilters(fromSearch(await searchParams));
    resolveVisitSite(scope, filters);
  } catch (cause) {
    filterError =
      cause instanceof Error ? cause.message : "Revisa los filtros.";
  }
  const { visits, total } = filterError
    ? { visits: [], total: 0 }
    : await getVisitPage(scope, filters);
  const pages = Math.max(1, Math.ceil(total / VISIT_PAGE_SIZE));
  const from = total ? (filters.page - 1) * VISIT_PAGE_SIZE + 1 : 0;
  const to = Math.min(filters.page * VISIT_PAGE_SIZE, total);
  const filterParams = visitSearchParams(filters, 1);
  const filteredGates = filters.site
    ? scope.gates.filter((gate) => gate.site_id === filters.site)
    : scope.gates;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Operación</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Registros de ronda
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Filtra visitas, revisa su ubicación y exporta los mismos resultados.
          </p>
        </div>
        {!filterError && (
          <a
            href={`/api/admin/visits/export?${filterParams}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Download className="size-4" /> Exportar CSV
          </a>
        )}
      </header>

      <form method="get" className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Filter className="size-4 text-primary" /> Filtros
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectFilter
            name="site"
            label="Sede"
            value={filters.site}
            allLabel="Todas las sedes"
            options={scope.sites.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
          />
          <SelectFilter
            name="gate"
            label="Garita"
            value={filters.gate}
            allLabel="Todas las garitas"
            options={filteredGates.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
          />
          <SelectFilter
            name="guard"
            label="Guardia"
            value={filters.guard}
            allLabel="Todos los guardias"
            options={options.guards.map((item) => ({
              id: item.id,
              label: `${item.full_name} · ${item.employee_code}`,
            }))}
          />
          <SelectFilter
            name="point"
            label="Punto QR"
            value={filters.point}
            allLabel="Todos los puntos"
            options={options.points.map((item) => ({
              id: item.id,
              label: `${item.name} · ${item.code}`,
            }))}
          />
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Desde</span>
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="min-h-11 w-full rounded-xl border bg-card px-3"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Hasta</span>
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="min-h-11 w-full rounded-xl border bg-card px-3"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Las fechas usan la zona horaria de la sede. Si hay varias sedes,
          selecciónala antes de filtrar por fecha.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Aplicar filtros
          </button>
          <Link
            href="/admin/visits"
            className="inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-medium"
          >
            Limpiar
          </Link>
        </div>
      </form>

      {filterError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-red-50 p-4 text-sm text-destructive"
        >
          {filterError}
        </p>
      )}
      {!filterError && (
        <section aria-label="Resultados de visitas">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Visitas registradas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} {total === 1 ? "resultado" : "resultados"} · mostrando{" "}
                {from}–{to}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Página {filters.page} de {pages}
            </p>
          </div>
          {!visits.length ? (
            <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              No hay visitas para estos filtros.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visits.map((visit) => (
                  <article
                    key={visit.id}
                    className="rounded-2xl border bg-card p-5"
                  >
                    <p className="text-xs text-muted-foreground">
                      {formatVisitTime(
                        visit.recorded_at,
                        visit.gates.sites.timezone,
                      )}{" "}
                      · {visit.gates.name}
                    </p>
                    <h3 className="mt-2 font-semibold">
                      {visit.checkpoint_name_snapshot}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-4" /> {visit.area_name_snapshot}
                    </p>
                    <p className="mt-2 text-sm">
                      {visit.profiles.full_name} ·{" "}
                      {visit.profiles.employee_code}
                    </p>
                    <div className="mt-3 border-t pt-3">
                      <VisitLocation
                        geoStatus={visit.geo_status}
                        latitude={visit.latitude}
                        longitude={visit.longitude}
                        accuracyM={visit.accuracy_m}
                        clientIp={visit.client_ip}
                      />
                    </div>
                    <Link
                      href={`/admin/visits/${visit.id}`}
                      className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                    >
                      Ver detalle →
                    </Link>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-secondary text-xs uppercase tracking-wide text-secondary-foreground">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Sede / garita</th>
                      <th className="px-4 py-3">Punto / área</th>
                      <th className="px-4 py-3">Guardia</th>
                      <th className="px-4 py-3">Ubicación</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visits.map((visit) => (
                      <tr key={visit.id}>
                        <td className="whitespace-nowrap px-4 py-4 align-top">
                          {formatVisitTime(
                            visit.recorded_at,
                            visit.gates.sites.timezone,
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          {visit.gates.sites.name}
                          <br />
                          <span className="text-muted-foreground">
                            {visit.gates.name}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="font-medium">
                            {visit.checkpoint_name_snapshot}
                          </span>
                          <br />
                          <span className="text-muted-foreground">
                            {visit.area_name_snapshot}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {visit.profiles.full_name}
                          <br />
                          <span className="text-muted-foreground">
                            {visit.profiles.employee_code}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <VisitLocation
                            geoStatus={visit.geo_status}
                            latitude={visit.latitude}
                            longitude={visit.longitude}
                            accuracyM={visit.accuracy_m}
                            clientIp={visit.client_ip}
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Link
                            href={`/admin/visits/${visit.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <nav
            aria-label="Páginas de visitas"
            className="mt-5 flex justify-between gap-3"
          >
            {filters.page > 1 ? (
              <Link
                href={`/admin/visits?${visitSearchParams(filters, filters.page - 1)}`}
                className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {filters.page < pages && (
              <Link
                href={`/admin/visits?${visitSearchParams(filters, filters.page + 1)}`}
                className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium"
              >
                Siguiente →
              </Link>
            )}
          </nav>
        </section>
      )}
    </div>
  );
}
