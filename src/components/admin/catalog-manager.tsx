"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Pencil,
  Plus,
  QrCode,
  Search,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RemoteSelect } from "@/components/admin/remote-select";
import { QrPanel } from "@/components/admin/qr-panel";
import type { CatalogResource } from "@/lib/admin/catalog-schema";

type Row = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  timezone?: string;
  site_id?: string;
  parent_id?: string | null;
  area_id?: string;
  description?: string | null;
  last_verified_at?: string | null;
};
type Draft = {
  code: string;
  name: string;
  timezone: string;
  site_id: string;
  parent_id: string;
  area_id: string;
  description: string;
};
const emptyDraft: Draft = {
  code: "",
  name: "",
  timezone: "America/Guatemala",
  site_id: "",
  parent_id: "",
  area_id: "",
  description: "",
};

const text = {
  sites: {
    title: "Sedes",
    singular: "sede",
    description: "Cada fábrica o recinto se organiza en una sede.",
  },
  gates: {
    title: "Garitas",
    singular: "garita",
    description: "Agrupa al personal según su puesto operativo.",
  },
  areas: {
    title: "Áreas",
    singular: "área",
    description: "Ordena la planta por edificios, secciones o zonas.",
  },
  checkpoints: {
    title: "Puntos QR",
    singular: "punto",
    description:
      "Cada ubicación física tiene un QR estático propio. Puedes añadir tantos puntos como necesites.",
  },
};

export function CatalogManager({ resource }: { resource: CatalogResource }) {
  const labels = text[resource];
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("true");
  const [filterId, setFilterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<Row | null>(null);
  const [qrPoint, setQrPoint] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        active,
        q: query,
      });
      if (filterId)
        params.set(
          resource === "checkpoints" ? "area_id" : "site_id",
          filterId,
        );
      const response = await fetch(`/api/admin/catalog/${resource}?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos cargar los registros.",
        );
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos cargar los registros.",
      );
    } finally {
      setLoading(false);
    }
  }, [resource, page, active, query, filterId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function startCreate() {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
    setError("");
  }
  function startEdit(row: Row) {
    setDraft({
      code: row.code,
      name: row.name,
      timezone: row.timezone ?? "America/Guatemala",
      site_id: row.site_id ?? "",
      parent_id: row.parent_id ?? "",
      area_id: row.area_id ?? "",
      description: row.description ?? "",
    });
    setEditingId(row.id);
    setOpen(true);
    setError("");
  }
  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data =
      resource === "sites"
        ? { code: draft.code, name: draft.name, timezone: draft.timezone }
        : resource === "gates"
          ? { code: draft.code, name: draft.name, site_id: draft.site_id }
          : resource === "areas"
            ? {
                code: draft.code,
                name: draft.name,
                site_id: draft.site_id,
                parent_id: draft.parent_id || null,
              }
            : {
                code: draft.code,
                name: draft.name,
                area_id: draft.area_id,
                description: draft.description || null,
              };
    try {
      const response = await fetch(
        editingId
          ? `/api/admin/catalog/${resource}/${editingId}`
          : `/api/admin/catalog/${resource}`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId ? { operation: "update", data } : data,
          ),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "No pudimos guardar.");
      setOpen(false);
      setMessage(
        `${labels.singular[0].toUpperCase()}${labels.singular.slice(1)} ${editingId ? "actualizada" : "creada"} correctamente.`,
      );
      await load();
      if (resource === "checkpoints" && !editingId) setQrPoint(result.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar.");
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(row: Row) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/catalog/${resource}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: row.active ? "archive" : "restore" }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos cambiar el estado.",
        );
      setConfirmation(null);
      setMessage(
        row.active
          ? "Registro archivado. Su historial se conserva."
          : "Registro activado.",
      );
      await load();
    } catch (cause) {
      setConfirmation(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos cambiar el estado.",
      );
    } finally {
      setPending(false);
    }
  }

  async function verify(row: Row) {
    const response = await fetch(`/api/admin/catalog/checkpoints/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "verify" }),
    });
    const result = await response.json();
    if (!response.ok)
      setError(result.error?.message ?? "No pudimos marcar la verificación.");
    else {
      setMessage("Punto marcado como verificado en sitio.");
      await load();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Configuración</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {labels.title}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {labels.description}
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="size-4" aria-hidden="true" /> Nueva {labels.singular}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-secondary p-4 text-sm font-medium text-secondary-foreground"
        >
          ✅ {message}
        </p>
      )}
      {error && !open && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_160px_1fr] sm:items-end">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
          className="flex gap-2"
        >
          <Input
            type="search"
            aria-label="Buscar por nombre"
            placeholder="Buscar por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <div>
          <label
            htmlFor="status-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Estado
          </label>
          <select
            id="status-filter"
            value={active}
            onChange={(event) => {
              setPage(1);
              setActive(event.target.value);
            }}
            className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
          >
            <option value="true">Activos</option>
            <option value="false">Archivados</option>
            <option value="all">Todos</option>
          </select>
        </div>
        {resource !== "sites" && (
          <RemoteSelect
            type={resource === "checkpoints" ? "areas" : "sites"}
            label={
              resource === "checkpoints"
                ? "Filtrar por área"
                : "Filtrar por sede"
            }
            value={filterId}
            onChange={(id) => {
              setPage(1);
              setFilterId(id);
            }}
            optional
          />
        )}
      </div>
      <div className="mt-5 space-y-3">
        {loading && (
          <p className="rounded-2xl border bg-card p-6 text-muted-foreground">
            Cargando registros…
          </p>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
            <p className="text-lg font-semibold">
              No hay {labels.title.toLowerCase()} con estos filtros
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Prueba otra búsqueda o crea un nuevo registro.
            </p>
          </div>
        )}
        {!loading &&
          items.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{row.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.active ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {row.active ? "Activo" : "Archivado"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.code}
                  {resource === "sites" && row.timezone
                    ? ` · ${row.timezone}`
                    : ""}
                </p>
                {resource === "checkpoints" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.last_verified_at
                      ? `Verificado: ${new Date(row.last_verified_at).toLocaleDateString("es-GT")}`
                      : "Pendiente de verificar en sitio"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(row)}
                >
                  <Pencil className="size-4" aria-hidden="true" /> Editar
                </Button>
                {resource === "checkpoints" && row.active && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQrPoint(row.id)}
                    >
                      <QrCode className="size-4" aria-hidden="true" /> QR
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => verify(row)}
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />{" "}
                      Verificar
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmation(row)}
                >
                  {row.active ? (
                    <Archive className="size-4" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden="true" />
                  )}
                  {row.active ? "Archivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
      </div>
      {total > 20 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Página {page} de {Math.ceil(total / 20)} · {total} registros
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {qrPoint && (
        <QrPanel
          key={qrPoint}
          pointId={qrPoint}
          onClose={() => setQrPoint(null)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar" : "Nueva"} {labels.singular}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del catálogo. El código se conserva para
              mantener referencias claras.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-code">Código</Label>
              <Input
                id="catalog-code"
                value={draft.code}
                onChange={(event) =>
                  update("code", event.target.value.toUpperCase())
                }
                disabled={!!editingId}
                placeholder={
                  resource === "checkpoints" ? "CENT-BOD-01" : "CENTRAL"
                }
                required
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-name">Nombre</Label>
              <Input
                id="catalog-name"
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
                required
                maxLength={100}
              />
            </div>
            {resource === "sites" && (
              <div className="space-y-2">
                <Label htmlFor="catalog-timezone">Zona horaria IANA</Label>
                <Input
                  id="catalog-timezone"
                  value={draft.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  required
                  placeholder="America/Guatemala"
                />
              </div>
            )}
            {(resource === "gates" || resource === "areas") && (
              <RemoteSelect
                type="sites"
                label="Sede"
                value={draft.site_id}
                onChange={(id) => {
                  update("site_id", id);
                  update("parent_id", "");
                }}
                disabled={!!editingId}
              />
            )}
            {resource === "areas" && draft.site_id && (
              <RemoteSelect
                type="areas"
                label="Área padre (opcional)"
                value={draft.parent_id}
                onChange={(id) => update("parent_id", id)}
                siteId={draft.site_id}
                optional
              />
            )}
            {resource === "checkpoints" && (
              <>
                <RemoteSelect
                  type="areas"
                  label="Área"
                  value={draft.area_id}
                  onChange={(id) => update("area_id", id)}
                  disabled={!!editingId}
                />
                <div className="space-y-2">
                  <Label htmlFor="catalog-description">
                    Referencia física (opcional)
                  </Label>
                  <Input
                    id="catalog-description"
                    value={draft.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    maxLength={500}
                    placeholder="Junto a la puerta norte"
                  />
                </div>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmation}
        onOpenChange={(value) => {
          if (!value) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800">
              <Archive className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirmation?.active ? "¿Archivar" : "¿Activar"}{" "}
              {confirmation?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.active
                ? "El registro desaparecerá de la operación habitual. Los datos históricos se conservarán."
                : "El registro volverá a estar disponible si sus relaciones siguen activas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              disabled={pending || !confirmation}
              onClick={() => confirmation && changeStatus(confirmation)}
            >
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
