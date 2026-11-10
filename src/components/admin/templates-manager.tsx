"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Pencil,
  Route,
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

type Point = { checkpoint_id: string; required: boolean };
type Template = {
  id: string;
  gate_id: string;
  name: string;
  is_default: boolean;
  active: boolean;
  gate: { name: string; code: string } | null;
  points: (Point & { position: number })[];
};
type Draft = {
  id: string | null;
  gate_id: string;
  name: string;
  is_default: boolean;
  points: Point[];
};
const empty: Draft = {
  id: null,
  gate_id: "",
  name: "",
  is_default: false,
  points: [],
};

export function TemplatesManager() {
  const [items, setItems] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [gateSiteId, setGateSiteId] = useState("");
  const [candidate, setCandidate] = useState("");
  const [pointNames, setPointNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<Template | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), q: query });
      const response = await fetch(`/api/admin/templates?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos cargar las plantillas.",
        );
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos cargar las plantillas.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, query]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!draft.gate_id) return;
    let cancelled = false;
    void fetch(`/api/admin/options?type=gates&id=${draft.gate_id}`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setGateSiteId(result.items?.[0]?.site_id ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [draft.gate_id]);

  useEffect(() => {
    if (!open || !draft.points.length) return;
    let cancelled = false;
    void Promise.all(
      draft.points.map(async (point) => {
        const response = await fetch(
          `/api/admin/options?type=checkpoints&id=${point.checkpoint_id}`,
        );
        const result = response.ok ? await response.json() : { items: [] };
        return [
          point.checkpoint_id,
          result.items?.[0]?.name ?? "Punto archivado",
        ] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setPointNames(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [open, draft.points]);

  function startCreate() {
    setDraft(empty);
    setCandidate("");
    setGateSiteId("");
    setOpen(true);
    setError("");
  }
  function startEdit(item: Template) {
    setDraft({
      id: item.id,
      gate_id: item.gate_id,
      name: item.name,
      is_default: item.is_default,
      points: item.points.map((point) => ({
        checkpoint_id: point.checkpoint_id,
        required: point.required,
      })),
    });
    setCandidate("");
    setGateSiteId("");
    setOpen(true);
    setError("");
  }
  function move(index: number, direction: number) {
    const next = [...draft.points];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, points: next });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos guardar la plantilla.",
        );
      setOpen(false);
      setMessage(
        draft.id
          ? "Plantilla actualizada. Las rondas anteriores conservan sus puntos."
          : "Plantilla creada.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar la plantilla.",
      );
    } finally {
      setPending(false);
    }
  }

  async function changeStatus() {
    if (!confirmation) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/templates/${confirmation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: confirmation.active ? "archive" : "restore",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos cambiar el estado.",
        );
      setConfirmation(null);
      setMessage("Estado de plantilla actualizado.");
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            Recorridos configurables
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Plantillas de ronda
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Elige qué puntos corresponden a cada garita y cuáles son
            obligatorios. Los cambios se aplican solo a rondas nuevas.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="size-4" aria-hidden="true" /> Nueva plantilla
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
        className="mt-8 flex gap-2 rounded-2xl border bg-card p-4"
      >
        <Input
          type="search"
          aria-label="Buscar plantilla"
          placeholder="Buscar plantilla"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search className="size-4" aria-hidden="true" /> Buscar
        </Button>
      </form>
      <div className="mt-5 space-y-3">
        {loading && (
          <p className="rounded-2xl border bg-card p-6 text-muted-foreground">
            Cargando plantillas…
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            Todavía no hay plantillas con esta búsqueda. Crea una después de
            registrar puntos QR.
          </p>
        )}
        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{item.name}</h2>
                  {item.is_default && item.active && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                      Predeterminada
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${item.active ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {item.active ? "Activa" : "Archivada"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.gate?.name ?? "Garita"} · {item.points.length}{" "}
                  {item.points.length === 1 ? "punto" : "puntos"} ·{" "}
                  {item.points.filter((point) => point.required).length}{" "}
                  obligatorios
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(item)}
                >
                  <Pencil className="size-4" aria-hidden="true" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmation(item)}
                >
                  {item.active ? (
                    <Archive className="size-4" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden="true" />
                  )}
                  {item.active ? "Archivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
      </div>
      {total > 20 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Página {page} de {Math.ceil(total / 20)} · {total} plantillas
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? "Editar plantilla" : "Nueva plantilla"}
            </DialogTitle>
            <DialogDescription>
              Selecciona una garita y añade sus puntos en el orden sugerido. El
              guardia podrá recorrerlos sin orden obligatorio.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nombre</Label>
              <Input
                id="template-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                required
                maxLength={100}
                placeholder="Ronda general"
              />
            </div>
            <RemoteSelect
              type="gates"
              label="Garita"
              value={draft.gate_id}
              disabled={!!draft.id}
              onChange={(id) => {
                setGateSiteId("");
                setCandidate("");
                setDraft({ ...draft, gate_id: id, points: [] });
              }}
            />
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.is_default}
                onChange={(event) =>
                  setDraft({ ...draft, is_default: event.target.checked })
                }
                className="size-5 accent-primary"
              />{" "}
              Plantilla predeterminada de la garita
            </label>
            {draft.gate_id && (
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-sm font-semibold">Puntos de la ronda</p>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    {gateSiteId ? (
                      <RemoteSelect
                        type="checkpoints"
                        label="Buscar punto de esta sede"
                        siteId={gateSiteId}
                        value={candidate}
                        onChange={setCandidate}
                        optional
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Cargando puntos de la sede…
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !candidate ||
                      draft.points.some(
                        (point) => point.checkpoint_id === candidate,
                      )
                    }
                    onClick={() => {
                      setDraft({
                        ...draft,
                        points: [
                          ...draft.points,
                          { checkpoint_id: candidate, required: true },
                        ],
                      });
                      setCandidate("");
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" /> Añadir
                  </Button>
                </div>
                {draft.points.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Añade al menos un punto.
                  </p>
                )}
                {draft.points.map((point, index) => (
                  <div
                    key={point.checkpoint_id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {index + 1}.{" "}
                      {pointNames[point.checkpoint_id] ?? "Cargando…"}
                    </span>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={point.required}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            points: draft.points.map((entry, position) =>
                              position === index
                                ? { ...entry, required: event.target.checked }
                                : entry,
                            ),
                          })
                        }
                        className="size-4 accent-primary"
                      />{" "}
                      Obligatorio
                    </label>
                    <button
                      type="button"
                      aria-label="Subir punto"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="rounded-lg p-2 hover:bg-card disabled:opacity-40"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bajar punto"
                      disabled={index === draft.points.length - 1}
                      onClick={() => move(index, 1)}
                      className="rounded-lg p-2 hover:bg-card disabled:opacity-40"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Quitar punto"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          points: draft.points.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                      className="rounded-lg p-2 text-destructive hover:bg-card"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
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
              <Button
                type="submit"
                disabled={
                  pending || !draft.gate_id || draft.points.length === 0
                }
              >
                {pending ? "Guardando…" : "Guardar plantilla"}
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
              <Route className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirmation?.active
                ? "¿Archivar plantilla?"
                : "¿Activar plantilla?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Las rondas que ya empezaron conservarán los puntos esperados que
              tenían al inicio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={changeStatus}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
