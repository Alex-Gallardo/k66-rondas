import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Search = Record<string, string | string[] | undefined>;
const categories = [
  { value: "", label: "Todas las acciones" },
  { value: "user.", label: "Usuarios" },
  { value: "site.", label: "Sedes y políticas" },
  { value: "sites.", label: "Sedes (catálogo)" },
  { value: "gates.", label: "Garitas" },
  { value: "areas.", label: "Áreas" },
  { value: "checkpoint.", label: "Puntos QR" },
  { value: "qr.", label: "Códigos QR" },
  { value: "template.", label: "Plantillas" },
  { value: "shift.", label: "Turnos" },
  { value: "patrol.", label: "Rondas" },
  { value: "visit.", label: "Visitas" },
] as const;
const pageSize = 25;

function dateValid(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function label(action: string) {
  const labels: Record<string, string> = {
    "site.policy.geo_updated": "Política GPS actualizada",
    "user.created": "Usuario creado",
    "user.updated": "Usuario actualizado",
    "qr.rotated": "QR reemplazado",
  };
  return labels[action] ?? action.replaceAll(".", " · ");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const category = typeof raw.action === "string" ? raw.action : "";
  const employee =
    typeof raw.employee === "string"
      ? raw.employee.trim().slice(0, 40).toUpperCase()
      : "";
  const from = typeof raw.from === "string" ? raw.from : "";
  const to = typeof raw.to === "string" ? raw.to : "";
  const page = Number(typeof raw.page === "string" ? raw.page : 1);
  const invalid =
    !categories.some((item) => item.value === category) ||
    (from !== "" && !dateValid(from)) ||
    (to !== "" && !dateValid(to)) ||
    (from !== "" && to !== "" && from > to) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000;

  const db = createAdminSupabase();
  let actorId: string | null = null;
  if (!invalid && employee) {
    const lookup = await db
      .from("profiles")
      .select("id")
      .eq("employee_code", employee)
      .maybeSingle();
    if (lookup.error) throw new Error("No pudimos consultar el usuario.");
    actorId = lookup.data?.id ?? null;
  }
  let events: {
    id: string;
    occurred_at: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: unknown;
    profiles: { full_name: string; employee_code: string } | null;
  }[] = [];
  let total = 0;
  if (!invalid && (!employee || actorId)) {
    let query = db
      .from("audit_events")
      .select(
        "id,occurred_at,action,entity_type,entity_id,metadata,profiles!audit_events_actor_id_fkey(full_name,employee_code)",
        { count: "exact" },
      )
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (category) query = query.like("action", `${category}%`);
    if (actorId) query = query.eq("actor_id", actorId);
    if (from) query = query.gte("occurred_at", `${from}T00:00:00Z`);
    if (to) {
      const next = new Date(`${to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      query = query.lt("occurred_at", next.toISOString());
    }
    const result = await query;
    if (result.error) throw new Error("No pudimos cargar la auditoría.");
    events = result.data ?? [];
    total = result.count ?? 0;
  }
  const filterParams = new URLSearchParams();
  if (category) filterParams.set("action", category);
  if (employee) filterParams.set("employee", employee);
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  function pageHref(nextPage: number) {
    const params = new URLSearchParams(filterParams);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/audit?${params.toString()}`;
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-primary">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Auditoría
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulta quién realizó cada cambio y cuándo ocurrió. Fechas en UTC.
        </p>
      </header>
      <form
        method="get"
        className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="space-y-1 text-sm font-medium">
          Acción
          <select
            name="action"
            defaultValue={category}
            className="min-h-11 w-full rounded-xl border bg-card px-3"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Código de usuario
          <input
            name="employee"
            defaultValue={employee}
            maxLength={40}
            placeholder="ADMIN-001"
            className="min-h-11 w-full rounded-xl border bg-card px-3"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Desde (UTC)
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="min-h-11 w-full rounded-xl border bg-card px-3"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Hasta (UTC)
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="min-h-11 w-full rounded-xl border bg-card px-3"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 self-end rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Filtrar
        </button>
      </form>
      {invalid && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-4 text-destructive"
        >
          Revisa los filtros de auditoría.
        </p>
      )}
      {!invalid && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-5 py-4 text-sm text-muted-foreground">
            {total} eventos encontrados
          </div>
          {events.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No hay eventos para estos filtros.
            </p>
          ) : (
            <div className="divide-y">
              {events.map((event) => {
                const metadata =
                  event.metadata &&
                  typeof event.metadata === "object" &&
                  !Array.isArray(event.metadata)
                    ? (event.metadata as Record<string, unknown>)
                    : {};
                const policyDetail =
                  event.action === "site.policy.geo_updated" &&
                  typeof metadata.previous === "boolean" &&
                  typeof metadata.current === "boolean"
                    ? `GPS: ${metadata.previous ? "activo" : "inactivo"} → ${metadata.current ? "activo" : "inactivo"}`
                    : null;
                return (
                  <article
                    key={event.id}
                    className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[190px_1fr_200px]"
                  >
                    <time
                      dateTime={event.occurred_at}
                      className="text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat("es-GT", {
                        dateStyle: "medium",
                        timeStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(event.occurred_at))}{" "}
                      UTC
                    </time>
                    <div>
                      <p className="font-semibold">{label(event.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.entity_type}
                        {event.entity_id ? ` · ${event.entity_id}` : ""}
                      </p>
                      {policyDetail && (
                        <p className="mt-1 text-xs text-primary">
                          {policyDetail}
                        </p>
                      )}
                    </div>
                    <p>
                      {event.profiles
                        ? `${event.profiles.full_name} · ${event.profiles.employee_code}`
                        : "Sistema o usuario eliminado"}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {!invalid && total > pageSize && (
        <nav
          aria-label="Páginas de auditoría"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Link
              className="rounded-xl border px-4 py-3"
              href={pageHref(page - 1)}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {page} de {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total ? (
            <Link
              className="rounded-xl border px-4 py-3"
              href={pageHref(page + 1)}
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
