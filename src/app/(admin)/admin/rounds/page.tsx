import Link from "next/link";
import { CalendarDays, Filter } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { formatVisitTime } from "@/lib/admin/visits";
import {
  emptyRoundFilters,
  getRoundGuards,
  getRoundPage,
  getRoundScope,
  parseRoundFilters,
  resolveRoundSite,
  roundDuration,
  ROUND_PAGE_SIZE,
  roundSearchParams,
  type RoundFilters,
} from "@/lib/admin/rounds";
import { RoundStatus } from "@/components/admin/round-status";

type Search = Record<string, string | string[] | undefined>;

function fromSearch(raw: Search) {
  const params = new URLSearchParams();
  for (const key of ["site", "gate", "guard", "status", "from", "to", "page"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

function SelectFilter({
  name,
  label,
  value,
  allLabel,
  options,
}: {
  name: string;
  label: string;
  value: string;
  allLabel: string;
  options: { id: string; label: string }[];
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

export default async function AdminRoundsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await requireActor(["admin", "supervisor"]);
  const scope = await getRoundScope(actor);
  const guards = await getRoundGuards(scope);
  let filters: RoundFilters = { ...emptyRoundFilters };
  let filterError = "";
  try {
    filters = parseRoundFilters(fromSearch(await searchParams));
    resolveRoundSite(scope, filters);
  } catch (cause) {
    filterError =
      cause instanceof Error ? cause.message : "Revisa los filtros.";
  }
  const { rounds, total } = filterError
    ? { rounds: [], total: 0 }
    : await getRoundPage(scope, filters);
  const pages = Math.max(1, Math.ceil(total / ROUND_PAGE_SIZE));
  const from = rounds.length ? (filters.page - 1) * ROUND_PAGE_SIZE + 1 : 0;
  const to = rounds.length
    ? Math.min(filters.page * ROUND_PAGE_SIZE, total)
    : 0;
  const gates = filters.site
    ? scope.gates.filter((gate) => gate.site_id === filters.site)
    : scope.gates;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-primary">Operación</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Rondas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulta recorridos completos, puntos pendientes y motivos de cierre.
        </p>
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
            options={scope.sites.map((site) => ({
              id: site.id,
              label: site.name,
            }))}
          />
          <SelectFilter
            name="gate"
            label="Garita"
            value={filters.gate}
            allLabel="Todas las garitas"
            options={gates.map((gate) => ({ id: gate.id, label: gate.name }))}
          />
          <SelectFilter
            name="guard"
            label="Guardia"
            value={filters.guard}
            allLabel="Todos los guardias"
            options={guards.map((guard) => ({
              id: guard.id,
              label: `${guard.full_name} · ${guard.employee_code}`,
            }))}
          />
          <SelectFilter
            name="status"
            label="Estado"
            value={filters.status}
            allLabel="Todos los estados"
            options={[
              { id: "in_progress", label: "En curso" },
              { id: "completed", label: "Completada" },
              { id: "incomplete", label: "Incompleta" },
            ]}
          />
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Inicio desde</span>
            <input
              name="from"
              type="date"
              defaultValue={filters.from}
              className="min-h-11 w-full rounded-xl border bg-card px-3"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Inicio hasta</span>
            <input
              name="to"
              type="date"
              defaultValue={filters.to}
              className="min-h-11 w-full rounded-xl border bg-card px-3"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Las fechas filtran el inicio de la ronda en la zona horaria de la
          sede. Si hay varias sedes, selecciona una antes de usar fechas.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Aplicar filtros
          </button>
          <Link
            href="/admin/rounds"
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
        <section aria-label="Resultados de rondas">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Rondas registradas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} {total === 1 ? "resultado" : "resultados"} · mostrando{" "}
                {from}–{to}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Página {filters.page} de {pages}
            </p>
          </div>
          {!rounds.length ? (
            <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              No hay rondas para estos filtros.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rounds.map((round) => {
                  const zone = round.gates.sites.timezone;
                  return (
                    <article
                      key={round.id}
                      className="rounded-2xl border bg-card p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <RoundStatus status={round.status} />
                        <span className="text-xs text-muted-foreground">
                          {formatVisitTime(round.started_at, zone)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold">
                        {round.shifts.gate_name_snapshot} ·{" "}
                        {round.gates.sites.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {round.profiles.full_name} ·{" "}
                        {round.profiles.employee_code}
                      </p>
                      <p className="mt-3 text-sm">
                        {round.progress.visited_total}/
                        {round.progress.expected_total} puntos ·{" "}
                        {round.progress.required_visited}/
                        {round.progress.required_total} obligatorios
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {round.ended_at ? "Duración" : "Transcurrido al cargar"}
                        : {roundDuration(round.started_at, round.ended_at)}
                      </p>
                      {round.status === "incomplete" && (
                        <p className="mt-2 text-sm text-amber-900">
                          {round.closure_reason}
                        </p>
                      )}
                      <Link
                        href={`/admin/rounds/${round.id}`}
                        className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary"
                      >
                        Ver detalle →
                      </Link>
                    </article>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-secondary text-xs uppercase tracking-wide text-secondary-foreground">
                    <tr>
                      <th className="px-4 py-3">Inicio</th>
                      <th className="px-4 py-3">Sede / garita</th>
                      <th className="px-4 py-3">Guardia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Avance</th>
                      <th className="px-4 py-3">Tiempo</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rounds.map((round) => (
                      <tr key={round.id}>
                        <td className="whitespace-nowrap px-4 py-4 align-top">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-4 text-primary" />
                            {formatVisitTime(
                              round.started_at,
                              round.gates.sites.timezone,
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {round.gates.sites.name}
                          <br />
                          <span className="text-muted-foreground">
                            {round.shifts.gate_name_snapshot}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {round.profiles.full_name}
                          <br />
                          <span className="text-muted-foreground">
                            {round.profiles.employee_code}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <RoundStatus status={round.status} />
                        </td>
                        <td className="px-4 py-4 align-top">
                          {round.progress.visited_total}/
                          {round.progress.expected_total} puntos
                          <br />
                          <span className="text-muted-foreground">
                            {round.progress.required_visited}/
                            {round.progress.required_total} obligatorios
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {roundDuration(round.started_at, round.ended_at)}
                          {!round.ended_at && (
                            <span className="block text-xs text-muted-foreground">
                              al cargar
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Link
                            href={`/admin/rounds/${round.id}`}
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
            aria-label="Páginas de rondas"
            className="mt-5 flex justify-between gap-3"
          >
            {filters.page > 1 ? (
              <Link
                href={`/admin/rounds?${roundSearchParams(filters, filters.page - 1)}`}
                className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {filters.page < pages && (
              <Link
                href={`/admin/rounds?${roundSearchParams(filters, filters.page + 1)}`}
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
