"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  Circle,
  Clock3,
  DoorOpen,
  MapPin,
  Play,
  QrCode,
  Route,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { LogoutButton } from "@/components/shared/logout-button";
import type { getGuardCurrent } from "@/lib/guard/current";

type GuardState = Awaited<ReturnType<typeof getGuardCurrent>>;
type Action = "close-patrol" | "close-shift" | null;

function displayTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function GuardOperations({
  actor,
  initial,
}: {
  actor: { fullName: string; employeeCode: string };
  initial: GuardState;
}) {
  const [current, setCurrent] = useState(initial);
  const [gateId, setGateId] = useState(initial.gates[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/shifts/current", { cache: "no-store" });
    if (!response.ok)
      throw new Error("No pudimos actualizar el estado del turno.");
    setCurrent((await response.json()) as GuardState);
    setTemplateId("");
  }

  async function submit(
    path: string,
    body: Record<string, unknown>,
    success: string,
  ) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos completar la acción.",
        );
      await refresh();
      setAction(null);
      setReason("");
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos completar la acción.",
      );
    } finally {
      setPending(false);
    }
  }

  const points = current.patrol?.points ?? [];
  const visited = points.filter((point) => point.visited).length;
  const missingRequired = points.filter(
    (point) => point.required && !point.visited,
  ).length;
  const chosenTemplate =
    templateId ||
    current.templates.find((item) => item.is_default)?.id ||
    (current.templates.length === 1 ? current.templates[0].id : "");

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-24 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <strong>K66 Rondas</strong>
        </div>
        <LogoutButton />
      </header>

      <section className="mt-8 rounded-[2rem] bg-[#103d32] p-6 text-white sm:p-7">
        <p className="text-sm text-[#cce6d9]">
          Cuenta personal · {actor.employeeCode}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Hola, {actor.fullName.split(" ")[0]} 👋
        </h1>
        <p className="mt-3 text-sm text-[#d3e9de]">
          {current.shift
            ? `Turno activo · ${current.shift.gate_name_snapshot}`
            : "Elige tu garita para comenzar el turno."}
        </p>
        {current.shift && (
          <p className="mt-2 flex items-center gap-2 text-xs text-[#cce6d9]">
            <Clock3 className="size-4" aria-hidden="true" /> Desde{" "}
            {displayTime(
              current.shift.started_at,
              current.timezone ?? "America/Guatemala",
            )}
          </p>
        )}
      </section>

      <Link
        href="/app/scan"
        className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <QrCode className="size-6" aria-hidden="true" /> Escanear QR
      </Link>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Si es tu única garita, el turno y la ronda comienzan automáticamente al
        escanear.
      </p>
      <div className="mt-4 flex justify-center">
        <Link
          href="/app/history"
          className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary hover:bg-secondary"
        >
          Ver mi historial →
        </Link>
        {actor.employeeCode === "DEMO-001" && (
          <Link
            href="/app/demo-qr"
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary hover:bg-secondary"
          >
            QR de demostración →
          </Link>
        )}
      </div>
      {current.recentVisit && (
        <section
          className="mt-5 rounded-2xl border bg-card p-4"
          aria-label="Último registro"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Último punto registrado
          </p>
          <p className="mt-2 font-semibold">
            {current.recentVisit.checkpoint_name_snapshot}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.recentVisit.area_name_snapshot} ·{" "}
            {displayTime(
              current.recentVisit.recorded_at,
              current.timezone ?? "America/Guatemala",
            )}
          </p>
        </section>
      )}

      {message && (
        <p
          role="status"
          className="mt-5 rounded-2xl bg-secondary p-4 text-sm font-medium text-secondary-foreground"
        >
          ✅ {message}
        </p>
      )}
      {error && !action && (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!current.shift && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">¿Desde qué garita trabajas?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu nombre quedará asociado a las rondas de este turno.
          </p>
          {current.gates.length ? (
            <div className="mt-5 space-y-3">
              {current.gates.map((gate) => (
                <label
                  key={gate.id}
                  className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4 ${gateId === gate.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <input
                    type="radio"
                    name="gate"
                    value={gate.id}
                    checked={gateId === gate.id}
                    onChange={() => setGateId(gate.id)}
                    className="size-5 accent-primary"
                  />
                  <DoorOpen
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{gate.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {gate.code}
                    </span>
                  </span>
                </label>
              ))}
              <Button
                className="mt-3 min-h-13 w-full text-base"
                disabled={pending || !gateId}
                onClick={() =>
                  submit("/api/shifts", { gate_id: gateId }, "Turno iniciado.")
                }
              >
                <Play className="size-5" aria-hidden="true" />{" "}
                {pending ? "Iniciando…" : "Iniciar turno"}
              </Button>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              Aún no tienes una garita asignada. Solicita acceso a tu
              administrador.
            </p>
          )}
        </section>
      )}

      {current.shift && !current.patrol && (
        <section className="mt-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Route className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Comienza una ronda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona el recorrido de esta garita. Puedes cerrar el turno si
            aún no necesitas hacer una ronda.
          </p>
          {current.templates.length ? (
            <div className="mt-5 space-y-3">
              {current.templates.map((template) => (
                <label
                  key={template.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4 ${chosenTemplate === template.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={chosenTemplate === template.id}
                    onChange={() => setTemplateId(template.id)}
                    className="size-5 accent-primary"
                  />
                  <span className="flex-1 font-medium">{template.name}</span>
                  {template.is_default && (
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs text-primary">
                      Sugerida
                    </span>
                  )}
                </label>
              ))}
              <Button
                className="mt-3 min-h-13 w-full text-base"
                disabled={pending || !chosenTemplate}
                onClick={() =>
                  submit(
                    "/api/patrols",
                    { template_id: chosenTemplate },
                    "Ronda iniciada.",
                  )
                }
              >
                <Play className="size-5" aria-hidden="true" />{" "}
                {pending ? "Iniciando…" : "Comenzar ronda"}
              </Button>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              No hay una plantilla activa para esta garita. Pide a tu
              administrador que la configure.
            </p>
          )}
          <Button
            variant="outline"
            className="mt-8 min-h-12 w-full"
            onClick={() => setAction("close-shift")}
          >
            <Square className="size-4" aria-hidden="true" /> Cerrar turno
          </Button>
        </section>
      )}

      {current.shift && current.patrol && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">
                Ronda en curso
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Tu recorrido</h2>
            </div>
            <strong className="text-2xl text-primary">
              {visited}/{points.length}
            </strong>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${points.length ? (visited / points.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {missingRequired}{" "}
            {missingRequired === 1
              ? "punto obligatorio pendiente"
              : "puntos obligatorios pendientes"}
          </p>
          <div className="mt-6 space-y-3">
            {points.map((point) => (
              <div
                key={point.checkpoint_id}
                className="flex items-start gap-3 rounded-2xl border bg-card p-4"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${point.visited ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {point.visited ? (
                    <Check className="size-5" />
                  ) : (
                    <Circle className="size-5" />
                  )}
                </span>
                <div>
                  <p className="font-medium">
                    {point.checkpoint_name_snapshot}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {point.area_name_snapshot} ·{" "}
                    {point.required ? "Obligatorio" : "Opcional"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-5 min-h-12 w-full"
            onClick={() => setAction("close-patrol")}
          >
            <Square className="size-4" aria-hidden="true" /> Cerrar ronda
          </Button>
        </section>
      )}

      <AlertDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setReason("");
            setError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800">
              <Square className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {action === "close-patrol"
                ? "¿Cerrar esta ronda?"
                : "¿Terminar el turno?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "close-patrol"
                ? missingRequired
                  ? "Quedan puntos obligatorios sin visitar. Indica por qué terminas la ronda; quedará marcada como incompleta."
                  : "La ronda se marcará como completada."
                : "Después de cerrar el turno, cierra sesión antes de entregar el teléfono."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action === "close-patrol" && missingRequired > 0 && (
            <div className="space-y-2">
              <label htmlFor="closure-reason" className="text-sm font-medium">
                Motivo del cierre
              </label>
              <Textarea
                id="closure-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Ej. Acceso restringido por mantenimiento"
              />
            </div>
          )}
          {error && action && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar</AlertDialogCancel>
            <Button
              disabled={
                pending ||
                (action === "close-patrol" &&
                  missingRequired > 0 &&
                  reason.trim().length < 4)
              }
              onClick={() =>
                action === "close-patrol"
                  ? submit(
                      `/api/patrols/${current.patrol?.id}/close`,
                      { reason },
                      "Ronda cerrada.",
                    )
                  : submit(
                      `/api/shifts/${current.shift?.id}/close`,
                      {},
                      "Turno cerrado. Cierra sesión antes de entregar el teléfono.",
                    )
              }
            >
              {pending ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
