"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Search,
  UserX,
  UserCheck,
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
import { GateAssignments } from "@/components/admin/gate-assignments";

type Role = "guard" | "supervisor" | "admin";
type User = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  gate_ids: string[];
};
type Draft = {
  employee_code: string;
  full_name: string;
  role: Role;
  gate_ids: string[];
};
const blank: Draft = {
  employee_code: "",
  full_name: "",
  role: "guard",
  gate_ids: [],
};
const roles: Record<Role, string> = {
  guard: "Guardia",
  supervisor: "Supervisor",
  admin: "Administrador",
};

export function UsersManager() {
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<{
    user: User;
    action: "status" | "reset";
  } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), q: query });
      const response = await fetch(`/api/admin/users?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos cargar las cuentas.",
        );
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos cargar las cuentas.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function create() {
    setEditing(null);
    setDraft(blank);
    setError("");
    setOpen(true);
  }
  function edit(user: User) {
    setEditing(user);
    setDraft({
      employee_code: user.employee_code,
      full_name: user.full_name,
      role: user.role,
      gate_ids: user.gate_ids,
    });
    setError("");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/admin/users/${editing.id}` : "/api/admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? {
                  full_name: draft.full_name,
                  role: draft.role,
                  gate_ids: draft.gate_ids,
                  active: editing.active,
                }
              : draft,
          ),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos guardar la cuenta.",
        );
      setOpen(false);
      setMessage(
        editing
          ? "Cuenta actualizada."
          : "Cuenta creada. Entrega la contraseña temporal en persona.",
      );
      if (result.temporary_password)
        setTemporaryPassword(result.temporary_password);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar la cuenta.",
      );
    } finally {
      setPending(false);
    }
  }

  async function executeConfirmed() {
    if (!confirm) return;
    setPending(true);
    setError("");
    try {
      const { user, action } = confirm;
      const response =
        action === "reset"
          ? await fetch(`/api/admin/users/${user.id}/reset-password`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            })
          : await fetch(`/api/admin/users/${user.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                full_name: user.full_name,
                role: user.role,
                gate_ids: user.gate_ids,
                active: !user.active,
              }),
            });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos completar la acción.",
        );
      setConfirm(null);
      if (result.temporary_password)
        setTemporaryPassword(result.temporary_password);
      setMessage(
        action === "reset"
          ? "Contraseña restablecida. Entrégala en persona."
          : user.active
            ? "Cuenta desactivada. Su historial se conserva."
            : "Cuenta activada.",
      );
      await load();
    } catch (cause) {
      setConfirm(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos completar la acción.",
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
            Equipo de seguridad
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Usuarios
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Una cuenta por persona, incluso cuando varias personas usan el mismo
            teléfono de garita.
          </p>
        </div>
        <Button onClick={create}>
          <Plus className="size-4" aria-hidden="true" /> Nuevo usuario
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
          aria-label="Buscar usuario por nombre"
          placeholder="Buscar por nombre"
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
            Cargando usuarios…
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            No hay usuarios con esta búsqueda. Crea la primera cuenta o cambia
            el filtro.
          </p>
        )}
        {!loading &&
          items.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{user.full_name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {user.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.employee_code} · {roles[user.role]} ·{" "}
                  {user.gate_ids.length}{" "}
                  {user.gate_ids.length === 1 ? "garita" : "garitas"}
                </p>
                {user.must_change_password && (
                  <p className="mt-1 text-xs text-amber-700">
                    Cambio de contraseña pendiente
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => edit(user)}>
                  <Pencil className="size-4" aria-hidden="true" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm({ user, action: "reset" })}
                >
                  <KeyRound className="size-4" aria-hidden="true" /> Restablecer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm({ user, action: "status" })}
                >
                  {user.active ? (
                    <UserX className="size-4" aria-hidden="true" />
                  ) : (
                    <UserCheck className="size-4" aria-hidden="true" />
                  )}
                  {user.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
      </div>
      {total > 20 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Página {page} de {Math.ceil(total / 20)} · {total} usuarios
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
              {editing ? "Editar usuario" : "Nuevo usuario"}
            </DialogTitle>
            <DialogDescription>
              Asigna un código personal y las garitas que podrá usar. La
              contraseña temporal se mostrará una sola vez.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-code">Código de empleado</Label>
              <Input
                id="user-code"
                value={draft.employee_code}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    employee_code: event.target.value.toUpperCase(),
                  })
                }
                disabled={!!editing}
                required
                maxLength={32}
                placeholder="G-0042"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre completo</Label>
              <Input
                id="user-name"
                value={draft.full_name}
                onChange={(event) =>
                  setDraft({ ...draft, full_name: event.target.value })
                }
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rol</Label>
              <select
                id="user-role"
                value={draft.role}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as Role })
                }
                className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
              >
                <option value="guard">Guardia</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <GateAssignments
              ids={draft.gate_ids}
              onChange={(ids) => setDraft({ ...draft, gate_ids: ids })}
            />
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
                {pending ? "Guardando…" : "Guardar usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(value) => {
          if (!value) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800">
              {confirm?.action === "reset" ? (
                <KeyRound className="size-5" />
              ) : (
                <UserX className="size-5" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirm?.action === "reset"
                ? "¿Restablecer contraseña?"
                : confirm?.user.active
                  ? "¿Desactivar cuenta?"
                  : "¿Activar cuenta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "reset"
                ? "La contraseña anterior dejará de funcionar. Entrega la nueva personalmente."
                : confirm?.user.active
                  ? "La persona no podrá iniciar nuevas sesiones; su historial seguirá visible."
                  : "La persona podrá volver a iniciar sesión."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={executeConfirmed}>
              {pending ? "Procesando…" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!temporaryPassword}
        onOpenChange={(value) => {
          if (!value) setTemporaryPassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña temporal creada</DialogTitle>
            <DialogDescription>
              Muéstrala únicamente a la persona en un canal privado. No volverá
              a aparecer en el panel.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted p-4">
            <code className="break-all text-sm font-semibold">
              {temporaryPassword}
            </code>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(temporaryPassword)}
            >
              <Copy className="size-4" aria-hidden="true" /> Copiar
            </Button>
            <Button type="button" onClick={() => setTemporaryPassword("")}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
