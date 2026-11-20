"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  HousePlus,
  QrCode,
  Square,
  UserRound,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogoutButton } from "@/components/shared/logout-button";
import type { getGuardCurrent } from "@/lib/guard/current";
import { greetingForTime } from "@/lib/guard/greeting";
import { useOnlineStatus } from "@/lib/online-status";
import {
  GuardActionBar,
  guardDockSpace,
  guardPage,
  guardPrimary,
  guardSecondary,
  RoutePoint,
  RouteProgress,
} from "./guard-ui";

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
  initialGreeting,
}: {
  actor: { fullName: string; employeeCode: string };
  initial: GuardState;
  initialGreeting: string;
}) {
  const online = useOnlineStatus();
  const [current, setCurrent] = useState(initial);
  const [gateId, setGateId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [greeting, setGreeting] = useState(initialGreeting);

  const timezone = current.timezone ?? "America/Guatemala";
  useEffect(() => {
    const updateGreeting = () =>
      setGreeting(greetingForTime(new Date(), timezone));
    const timer = window.setInterval(updateGreeting, 60_000);
    const firstUpdate = window.setTimeout(updateGreeting, 0);
    document.addEventListener("visibilitychange", updateGreeting);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(firstUpdate);
      document.removeEventListener("visibilitychange", updateGreeting);
    };
  }, [timezone]);

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
      setAction(null);
      setReason("");
      setMessage(success);
      const refresh = await fetch("/api/shifts/current", { cache: "no-store" });
      if (!refresh.ok) throw new Error();
      setCurrent((await refresh.json()) as GuardState);
      setTemplateId("");
      setGateId("");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "No pudimos actualizar el turno. Vuelve al inicio para consultar el estado.",
      );
    } finally {
      setPending(false);
    }
  }

  const { gates, shift, patrol, templates, recentVisit } = current;
  const onlyGate = gates.length === 1 ? gates[0] : null;
  const automaticTemplate =
    templates.find((item) => item.is_default) ??
    (templates.length === 1 ? templates[0] : null);
  const canScan = Boolean(patrol || ((shift || onlyGate) && automaticTemplate));
  const selectedGate = onlyGate?.id ?? gateId;
  const selectedTemplate = templateId || automaticTemplate?.id || "";
  const points = patrol?.points ?? [];
  const visited = points.filter((point) => point.visited).length;
  const missingRequired = points.filter(
    (point) => point.required && !point.visited,
  ).length;
  const commonArea =
    points.length > 1 &&
    points.every(
      (point) => point.area_name_snapshot === points[0].area_name_snapshot,
    )
      ? points[0].area_name_snapshot
      : null;
  const showGateSelection = !shift && gates.length > 0;
  const showTemplateSelection = !!shift && !patrol && templates.length > 0;
  const selectionKey = shift?.id ?? "no-shift";

  const gateForm = (
    <section aria-labelledby="guard-gate-title">
      <h2 id="guard-gate-title" className="text-base font-semibold">
        ¿Desde qué garita trabajas?
      </h2>
      {gates.length > 1 && (
        <div
          role="group"
          aria-labelledby="guard-gate-title"
          className="mt-2 grid gap-2"
        >
          {gates.map((gate) => (
            <label
              key={gate.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 has-checked:border-primary"
            >
              <input
                type="radio"
                name="gate"
                value={gate.id}
                checked={selectedGate === gate.id}
                onChange={() => setGateId(gate.id)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 break-words text-sm font-medium">
                {gate.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {gate.code}
              </span>
            </label>
          ))}
        </div>
      )}
      {onlyGate && (
        <p className="mt-1 text-sm text-muted-foreground">{onlyGate.name}</p>
      )}
      <Button
        className="mt-3 h-12 w-full"
        disabled={!online || pending || !selectedGate}
        onClick={() =>
          void submit(
            "/api/shifts",
            { gate_id: selectedGate },
            "Turno iniciado.",
          )
        }
      >
        {pending ? "Iniciando…" : "Iniciar turno"}
      </Button>
    </section>
  );

  const templateForm = (
    <section aria-labelledby="guard-template-title">
      <h2 id="guard-template-title" className="text-base font-semibold">
        Comienza una ronda
      </h2>
      <div
        role="group"
        aria-labelledby="guard-template-title"
        className="mt-2 grid gap-2"
      >
        {templates.map((template) => (
          <label
            key={template.id}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 has-checked:border-primary"
          >
            <input
              type="radio"
              name="template"
              value={template.id}
              checked={selectedTemplate === template.id}
              onChange={() => setTemplateId(template.id)}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1 break-words text-sm font-medium">
              {template.name}
            </span>
            {template.is_default && (
              <span className="text-xs text-muted-foreground">Sugerido</span>
            )}
          </label>
        ))}
      </div>
      <Button
        className="mt-3 h-12 w-full"
        disabled={!online || pending || !selectedTemplate}
        onClick={() =>
          void submit(
            "/api/patrols",
            { template_id: selectedTemplate },
            "Ronda iniciada.",
          )
        }
      >
        {pending ? "Iniciando…" : "Comenzar ronda"}
      </Button>
    </section>
  );

  return (
    <main className={`${guardPage} ${canScan ? guardDockSpace : "pb-10"}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <strong className="text-base tracking-tight">K66 Rondas</strong>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="h-12 min-w-12 gap-2 rounded-xl"
              />
            }
          >
            <UserRound className="size-4" aria-hidden="true" /> Cuenta
          </DialogTrigger>
          <DialogContent
            showCloseButton={false}
            className="rounded-2xl motion-reduce:animate-none"
          >
            <DialogTitle className="text-lg">Mi cuenta</DialogTitle>
            <DialogDescription>
              {actor.fullName} · {actor.employeeCode}
            </DialogDescription>
            {actor.employeeCode === "DEMO-001" && (
              <Link
                href="/app/demo-qr"
                className={`${guardSecondary} justify-start border`}
              >
                <QrCode className="size-4" aria-hidden="true" /> QR de
                demostración
              </Link>
            )}
            <Link
              href="/install"
              className={`${guardSecondary} justify-start border`}
            >
              <HousePlus className="size-4" aria-hidden="true" /> Añadir app al
              inicio
            </Link>
            <LogoutButton className="h-12 w-full" />
            <DialogClose render={<Button variant="ghost" className="h-12" />}>
              Volver
            </DialogClose>
          </DialogContent>
        </Dialog>
      </header>

      <section className="mt-5">
        <p className="text-xs font-medium text-muted-foreground">
          Cuenta personal · {actor.employeeCode}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting}
        </h1>
      </section>

      <section
        aria-label="Estado de operación"
        className="mt-4 rounded-2xl bg-[#103d32] p-4 text-white sm:p-5"
      >
        <p className="text-sm text-[#d4f1e5]">
          {patrol
            ? "Ronda en curso"
            : shift
              ? "Turno activo"
              : "Sin turno activo"}
        </p>
        <p className="mt-0.5 break-words text-lg font-semibold">
          {shift?.gate_name_snapshot ?? onlyGate?.name ?? "Tu garita"}
        </p>
        {patrol ? (
          <div className="mt-3 border-t border-white/20 pt-3">
            <RouteProgress
              visited={visited}
              total={points.length}
              requiredLeft={missingRequired}
            />
          </div>
        ) : shift ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-[#d4f1e5]">
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{" "}
            Desde {displayTime(shift.started_at, timezone)}
          </p>
        ) : canScan ? (
          <p className="mt-2 text-sm text-[#d4f1e5]">
            Al escanear se inicia tu turno y tu ronda.
          </p>
        ) : null}
      </section>

      {message && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-secondary p-3 text-sm font-medium text-secondary-foreground"
        >
          {message}
        </p>
      )}
      {error && !action && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-destructive/20 bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {patrol && (
        <section aria-labelledby="guard-route-title" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <h2
              id="guard-route-title"
              className="text-lg font-semibold tracking-tight"
            >
              Tu recorrido
            </h2>
            <Button
              variant="ghost"
              className="h-12 text-muted-foreground"
              disabled={pending || !online}
              onClick={() => setAction("close-patrol")}
            >
              <Square className="size-4" aria-hidden="true" /> Cerrar ronda
            </Button>
          </div>
          {commonArea && (
            <p className="pb-2 text-xs text-muted-foreground">{commonArea}</p>
          )}
          {points.length > 0 && (
            <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
              {points.map((point) => (
                <RoutePoint
                  key={point.checkpoint_id}
                  name={point.checkpoint_name_snapshot}
                  area={commonArea ? undefined : point.area_name_snapshot}
                  visited={point.visited}
                  required={point.required}
                />
              ))}
            </ol>
          )}
        </section>
      )}
      {showGateSelection &&
        (canScan ? (
          <details
            key={selectionKey}
            className="mt-4 rounded-2xl border bg-card px-3"
          >
            <summary className="min-h-12 cursor-pointer content-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
              Iniciar turno manualmente
            </summary>
            <div className="pb-3">{gateForm}</div>
          </details>
        ) : (
          <div className="mt-4 rounded-2xl border bg-card p-4">{gateForm}</div>
        ))}
      {showTemplateSelection &&
        (canScan ? (
          <details
            key={selectionKey}
            className="mt-4 rounded-2xl border bg-card px-3"
          >
            <summary className="min-h-12 cursor-pointer content-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
              Elegir recorrido manualmente
            </summary>
            <div className="pb-3">{templateForm}</div>
          </details>
        ) : (
          <div className="mt-4 rounded-2xl border bg-card p-4">
            {templateForm}
          </div>
        ))}
      {!shift && gates.length === 0 && (
        <p className="mt-4 rounded-2xl border bg-card p-4 text-sm">
          Aún no tienes garita asignada. Solicita acceso a tu administrador.
        </p>
      )}
      {!patrol && (shift || onlyGate) && templates.length === 0 && (
        <p className="mt-4 rounded-2xl border bg-card p-4 text-sm">
          Esta garita no tiene un recorrido activo. Pide a tu administrador que
          lo configure.
        </p>
      )}
      {shift && !patrol && (
        <Button
          variant="ghost"
          className="mt-2 h-12 text-muted-foreground"
          disabled={pending || !online}
          onClick={() => setAction("close-shift")}
        >
          <Square className="size-4" aria-hidden="true" /> Cerrar turno
        </Button>
      )}

      <Link
        href="/app/history"
        aria-label="Ver mi historial"
        className={`${guardSecondary} mt-4 w-full justify-start border bg-card`}
      >
        <ClipboardList
          className="size-5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block">Mi historial</span>
          {recentVisit && (
            <span className="block break-words text-xs font-normal text-muted-foreground">
              <span>Último punto registrado</span> ·{" "}
              {recentVisit.checkpoint_name_snapshot} ·{" "}
              {displayTime(recentVisit.recorded_at, timezone)}
            </span>
          )}
        </span>
        <ChevronRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
      </Link>

      {canScan && (
        <GuardActionBar>
          {online ? (
            <Link href="/app/scan" className={guardPrimary}>
              <QrCode className="size-5" aria-hidden="true" /> Escanear QR
            </Link>
          ) : (
            <button type="button" disabled className={guardPrimary}>
              <QrCode className="size-5" aria-hidden="true" /> Escanear QR · sin
              conexión
            </button>
          )}
        </GuardActionBar>
      )}

      <AlertDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setAction(null);
            setReason("");
            setError("");
          }
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-900">
              {action === "close-patrol" && missingRequired === 0 ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <Square aria-hidden="true" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {action === "close-patrol"
                ? "¿Cerrar esta ronda?"
                : "¿Terminar el turno?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "close-patrol"
                ? missingRequired > 0
                  ? `${missingRequired === 1 ? "Falta 1 punto obligatorio" : `Faltan ${missingRequired} puntos obligatorios`}. Indica el motivo del cierre. La ronda quedará incompleta.`
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
                placeholder="Ej. Área cerrada por mantenimiento"
                className="text-base"
              />
            </div>
          )}
          {error && action && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12" disabled={pending}>
              Seguir trabajando
            </AlertDialogCancel>
            <Button
              className="h-12"
              disabled={
                !online ||
                pending ||
                (action === "close-patrol" &&
                  missingRequired > 0 &&
                  reason.trim().length < 4)
              }
              onClick={() => {
                if (action === "close-patrol" && patrol)
                  void submit(
                    `/api/patrols/${patrol.id}/close`,
                    { reason },
                    "Ronda cerrada.",
                  );
                if (action === "close-shift" && shift)
                  void submit(
                    `/api/shifts/${shift.id}/close`,
                    {},
                    "Turno cerrado. Cierra sesión antes de entregar el teléfono.",
                  );
              }}
            >
              {pending ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
