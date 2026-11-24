"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  LocateFixed,
  MapPinOff,
  QrCode,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseQrCode } from "@/lib/guard/qr";
import { captureLocation } from "@/lib/guard/geolocation";
import { compressPhoto } from "@/lib/guard/photo";
import { useOnlineStatus } from "@/lib/online-status";
import {
  guardPage,
  guardPrimary,
  guardSecondary,
  GuardVisitMeta,
} from "./guard-ui";

type VisitResult = {
  outcome: "recorded" | "idempotent" | "already_scanned";
  visit_id: string;
  recorded_at: string;
  checkpoint_name: string;
  area_name: string;
  progress: { visited: number; total: number };
  patrol_status: "in_progress" | "completed" | "incomplete";
};
type Phase =
  | "preparing"
  | "opening-camera"
  | "camera"
  | "locating"
  | "saving"
  | "success"
  | "error";
type LocationIssue = "denied" | "timeout" | "unavailable";
type ScanIssue = {
  kind: "camera" | "network" | "gps" | "qr" | "setup" | "session" | "server";
  message: string;
};

const issueLabels = {
  camera: { title: "Revisa el permiso de cámara", icon: Camera },
  network: { title: "Problema de conexión", icon: WifiOff },
  gps: { title: "Ubicación requerida", icon: MapPinOff },
  qr: { title: "No pudimos leer este punto", icon: QrCode },
  setup: { title: "Prepara tu ronda", icon: TriangleAlert },
  session: { title: "Sesión terminada", icon: TriangleAlert },
  server: { title: "El registro necesita revisión", icon: TriangleAlert },
};

export function QrScanner({
  initialCode,
  occurrenceId,
}: {
  initialCode?: string;
  occurrenceId?: string;
}) {
  const online = useOnlineStatus();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scheduledPatrol = useRef<string | undefined>(undefined);
  const controlsRef = useRef<IScannerControls | null>(null);
  const active = useRef(false);
  const busy = useRef(false);
  const pending = useRef<{ code: string; key: string } | null>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const evidenceBusy = useRef(false);
  const [timezone, setTimezone] = useState("America/Guatemala");
  const [phase, setPhase] = useState<Phase>("preparing");
  const [issue, setIssue] = useState<ScanIssue | null>(null);
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(
    null,
  );
  const [result, setResult] = useState<VisitResult | null>(null);
  const [retryCode, setRetryCode] = useState(false);
  const [retryPreparation, setRetryPreparation] = useState(!!initialCode);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [evidencePending, setEvidencePending] = useState<
    "note" | "photo" | null
  >(null);
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [photoToRetry, setPhotoToRetry] = useState<File | null>(null);
  const [photoSaved, setPhotoSaved] = useState(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const fail = useCallback((nextIssue: ScanIssue, sameCode = false) => {
    setIssue(nextIssue);
    setRetryCode(sameCode);
    setPhase("error");
  }, []);

  const saveCode = useCallback(
    async (raw: string, retry = false) => {
      if (busy.current) return;
      stopCamera();
      setLocationIssue(null);
      const code = parseQrCode(raw);
      if (!code) {
        fail({
          kind: "qr",
          message: "Prueba con otra etiqueta de K66 Rondas.",
        });
        return;
      }
      busy.current = true;
      const attempt =
        retry && pending.current?.code === code
          ? pending.current
          : { code, key: crypto.randomUUID() };
      pending.current = attempt;
      setPhase("locating");
      let sent = false;
      try {
        if (!navigator.onLine) {
          fail(
            {
              kind: "network",
              message: "Vuelve a conectarte para registrar este punto.",
            },
            true,
          );
          return;
        }
        const geo = await captureLocation();
        if (!active.current) return;
        if (geo.status !== "captured") {
          setLocationIssue(geo.status);
          fail(
            {
              kind: "gps",
              message:
                "Activa la ubicación del teléfono y permite el acceso a K66 Rondas. Este punto no se guardó.",
            },
            true,
          );
          return;
        }
        setPhase("saving");
        sent = true;
        const response = await fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr_code: code,
            idempotency_key: attempt.key,
            scheduled_patrol_id: scheduledPatrol.current,
            geo,
          }),
        });
        const data = await response.json();
        if (!active.current) return;
        if (!response.ok) {
          const errorCode = data.error?.code;
          const message = data.error?.message ?? "No pudimos guardar el punto.";
          if (response.status === 401) {
            fail({
              kind: "session",
              message: "Inicia sesión y vuelve a escanear.",
            });
          } else if (errorCode === "GEO_REQUIRED") {
            setLocationIssue("unavailable");
            fail({ kind: "gps", message }, true);
          } else if (errorCode === "PATROL_CHANGED") {
            fail({ kind: "setup", message });
          } else if (
            errorCode === "INVALID_QR" ||
            errorCode === "POINT_NOT_EXPECTED"
          ) {
            fail({ kind: "qr", message });
          } else {
            fail({ kind: "server", message }, response.status >= 500);
          }
          return;
        }
        pending.current = null;
        setResult(data as VisitResult);
        setNote("");
        setSavedNote("");
        setNoteOpen(false);
        setPhotoToRetry(null);
        setPhotoSaved(false);
        setEvidenceMessage("");
        setEvidenceError("");
        setPhase("success");
      } catch {
        if (active.current)
          fail(
            {
              kind: "network",
              message: sent
                ? "No pudimos confirmar el guardado. Reintenta este mismo punto para comprobarlo."
                : "Vuelve a conectarte para registrar este punto.",
            },
            true,
          );
      } finally {
        busy.current = false;
      }
    },
    [fail, stopCamera],
  );

  const prepare = useCallback(
    async (code?: string, signal?: AbortSignal) => {
      setResult(null);
      setIssue(null);
      setRetryCode(false);
      setRetryPreparation(!!code);
      setPhase("preparing");
      let openingCamera = false;
      try {
        if (!navigator.onLine) {
          fail({
            kind: "network",
            message: "Vuelve a conectarte para escanear.",
          });
          return;
        }
        const response = await fetch("/api/guard/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occurrence_id: occurrenceId }),
          signal,
        });
        const data = await response.json();
        if (!active.current || signal?.aborted) return;
        if (!response.ok) {
          const kind =
            response.status === 401
              ? "session"
              : [
                    "SELECT_GATE",
                    "SELECT_TEMPLATE",
                    "SELECT_OCCURRENCE",
                    "OCCURRENCE_UNAVAILABLE",
                    "WRONG_ACTIVE_GATE",
                    "PATROL_ALREADY_OPEN",
                  ].includes(data.error?.code)
                ? "setup"
                : "server";
          fail({
            kind,
            message: data.error?.message ?? "No pudimos preparar la ronda.",
          });
          return;
        }
        setTimezone(data.timezone ?? "America/Guatemala");
        scheduledPatrol.current = occurrenceId ? data.patrol_id : undefined;
        setRetryPreparation(false);
        if (code) {
          await saveCode(code);
          return;
        }
        openingCamera = true;
        setPhase("opening-camera");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error();
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!active.current || signal?.aborted || !videoRef.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (scan, _error, activeControls) => {
            if (!scan || !active.current || signal?.aborted || busy.current)
              return;
            activeControls.stop();
            void saveCode(scan.getText());
          },
        );
        if (
          !active.current ||
          signal?.aborted ||
          !navigator.onLine ||
          busy.current
        ) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setPhase((previous) =>
          previous === "opening-camera" ? "camera" : previous,
        );
      } catch (cause) {
        if (!active.current || signal?.aborted || busy.current) return;
        if (openingCamera) {
          stopCamera();
          fail({
            kind: "camera",
            message:
              cause instanceof DOMException && cause.name === "NotAllowedError"
                ? "Permite el acceso en los ajustes del navegador y vuelve a abrir la cámara."
                : "Comprueba el permiso de cámara y que otra app no la esté usando.",
          });
        } else {
          fail({
            kind: "network",
            message:
              "No pudimos conectar con el servidor. Reintenta cuando vuelva la red.",
          });
        }
      }
    },
    [fail, occurrenceId, saveCode, stopCamera],
  );

  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    queueMicrotask(() => {
      if (!controller.signal.aborted)
        void prepare(initialCode, controller.signal);
    });
    return () => {
      active.current = false;
      controller.abort();
      stopCamera();
    };
  }, [initialCode, prepare, stopCamera]);

  useEffect(() => {
    if (phase === "success")
      resultTitle.current?.focus({ preventScroll: true });
    if (phase !== "camera" && phase !== "opening-camera") return;
    function handleOffline() {
      stopCamera();
      fail({
        kind: "network",
        message: "Se perdió la conexión. Vuelve a conectarte para escanear.",
      });
    }
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [fail, phase, stopCamera]);

  useEffect(() => {
    if (noteOpen) noteInput.current?.focus();
  }, [noteOpen]);

  async function saveNote() {
    if (!result || !note.trim() || evidenceBusy.current) return;
    evidenceBusy.current = true;
    setEvidencePending("note");
    setEvidenceError("");
    setEvidenceMessage("");
    try {
      const response = await fetch(`/api/visits/${result.visit_id}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message ?? "No pudimos guardar la observación.",
        );
      setSavedNote(note.trim());
      setNoteOpen(false);
      setEvidenceMessage("Observación guardada.");
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar la observación.",
      );
    } finally {
      evidenceBusy.current = false;
      setEvidencePending(null);
    }
  }

  async function uploadPhoto(file: File) {
    if (!result || evidenceBusy.current) return;
    evidenceBusy.current = true;
    setPhotoToRetry(file);
    setEvidencePending("photo");
    setEvidenceError("");
    setEvidenceMessage("");
    try {
      const compressed = await compressPhoto(file);
      const form = new FormData();
      form.append("photo", compressed, "ronda.jpg");
      const response = await fetch(`/api/visits/${result.visit_id}/photo`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok && data.error?.code !== "PHOTO_EXISTS")
        throw new Error(data.error?.message ?? "No pudimos adjuntar la foto.");
      setPhotoToRetry(null);
      setPhotoSaved(true);
      setEvidenceMessage("Fotografía guardada.");
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error ? cause.message : "No pudimos adjuntar la foto.",
      );
    } finally {
      evidenceBusy.current = false;
      setEvidencePending(null);
    }
  }

  function retryPendingPoint() {
    if (pending.current) void saveCode(pending.current.code, true);
  }

  const canOpenCamera =
    ["preparing", "opening-camera", "camera"].includes(phase) &&
    !(phase === "preparing" && initialCode && retryPreparation);
  const issueInfo = issue ? issueLabels[issue.kind] : null;
  const IssueIcon = issueInfo?.icon;
  const completed = result?.patrol_status === "completed";
  const evidenceAvailable = result && result.outcome !== "already_scanned";
  const hasNoteDraft = note.trim() !== savedNote;
  const evidenceNeedsAttention = !!evidencePending || hasNoteDraft;
  return (
    <main className={`${guardPage} pb-10`}>
      <header className="flex items-center justify-between gap-3">
        {evidenceNeedsAttention ? (
          <Button variant="ghost" className="h-12" disabled>
            <ArrowLeft className="size-5" aria-hidden="true" /> Inicio
          </Button>
        ) : (
          <Link href="/app" onClick={stopCamera} className={guardSecondary}>
            <ArrowLeft className="size-5" aria-hidden="true" /> Inicio
          </Link>
        )}
        <strong className="text-sm tracking-tight">K66 Rondas</strong>
      </header>
      {phase !== "success" && (
        <section className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Escanear QR
          </h1>
          {canOpenCamera && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Centra el QR del punto dentro del marco.
            </p>
          )}
        </section>
      )}

      {canOpenCamera && (
        <div className="relative mt-4 aspect-[4/5] max-h-[min(62dvh,34rem)] overflow-hidden rounded-3xl border-4 border-[#103d32] bg-[#102720]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Vista de la cámara para leer QR"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[16%] grid place-items-center"
          >
            <div className="aspect-square max-h-full w-full max-w-[min(100%,52dvh)] rounded-2xl border-[3px] border-[#a9f4d5] shadow-[0_0_0_999px_rgba(10,28,23,0.36)]" />
          </div>
          {phase !== "camera" && (
            <p
              role="status"
              className="absolute inset-0 grid place-items-center bg-[#102720] px-4 text-center text-sm font-medium text-white"
            >
              {phase === "preparing"
                ? "Preparando la ronda…"
                : "Abriendo cámara…"}
            </p>
          )}
        </div>
      )}
      {phase === "camera" && (
        <p
          role="status"
          className="mt-3 text-center text-sm font-medium text-secondary-foreground"
        >
          Cámara activa
        </p>
      )}
      {phase === "preparing" && !canOpenCamera && (
        <p role="status" className="mt-4 rounded-2xl border bg-card p-5">
          Preparando la ronda…
        </p>
      )}
      {(phase === "locating" || phase === "saving") && (
        <div
          role="status"
          className="mt-4 flex gap-3 rounded-2xl bg-secondary p-5 text-secondary-foreground"
        >
          <LocateFixed className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {phase === "locating"
                ? "Obteniendo ubicación…"
                : "Guardando punto…"}
            </p>
            <p className="mt-0.5 text-sm">
              Espera la confirmación antes de continuar.
            </p>
          </div>
        </div>
      )}
      {phase === "error" && issue && issueInfo && IssueIcon && (
        <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div role="alert">
            <IssueIcon aria-hidden="true" className="size-6 text-destructive" />
            <h2 className="mt-2 text-lg font-semibold">{issueInfo.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {issue.message}
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            {issue.kind === "session" ? (
              <Link href="/login" className={guardPrimary}>
                Iniciar sesión
              </Link>
            ) : issue.kind === "setup" ? (
              <Link href="/app" className={guardPrimary}>
                Ir al inicio
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className={guardPrimary}
                  disabled={!online}
                  onClick={() =>
                    retryCode
                      ? retryPendingPoint()
                      : void prepare(retryPreparation ? initialCode : undefined)
                  }
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {retryCode
                    ? issue.kind === "gps"
                      ? "Reintentar ubicación"
                      : "Reintentar guardado"
                    : issue.kind === "camera"
                      ? "Volver a abrir cámara"
                      : issue.kind === "qr"
                        ? "Escanear otro QR"
                        : "Volver a intentar"}
                </button>
                {retryCode && (
                  <Button
                    variant="outline"
                    className="h-12"
                    disabled={!online}
                    onClick={() => {
                      pending.current = null;
                      void prepare();
                    }}
                  >
                    Escanear otro QR
                  </Button>
                )}
              </>
            )}
          </div>
        </section>
      )}
      <AlertDialog
        open={locationIssue !== null}
        onOpenChange={(open) => {
          if (!open) setLocationIssue(null);
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-900">
              <MapPinOff className="size-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Activa la ubicación GPS</AlertDialogTitle>
            <AlertDialogDescription>
              {locationIssue === "denied"
                ? "Activa la ubicación del teléfono y permite el acceso a K66 Rondas en los ajustes del navegador."
                : locationIssue === "timeout"
                  ? "No recibimos la ubicación a tiempo. Comprueba el GPS y prueba desde un lugar con mejor señal."
                  : "El dispositivo no entregó coordenadas. Revisa la ubicación del teléfono y el permiso del sitio."}{" "}
              Este punto no se guardó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              className="h-12"
              variant="outline"
              onClick={() => setLocationIssue(null)}
            >
              Entendido
            </Button>
            <Button
              className="h-12"
              disabled={!online}
              onClick={retryPendingPoint}
            >
              Reintentar GPS
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {phase === "success" && result && (
        <section className="mt-4 overflow-hidden rounded-2xl border bg-card motion-safe:animate-in motion-safe:fade-in-0">
          <div className="bg-secondary p-4 sm:p-5">
            <p
              id="guard-scan-result"
              className="flex items-center gap-2 text-sm font-semibold text-secondary-foreground"
            >
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              {result.outcome === "already_scanned"
                ? "Ya registrado en esta ronda"
                : "Punto registrado"}
            </p>
            <h1
              ref={resultTitle}
              tabIndex={-1}
              aria-describedby="guard-scan-result"
              className="mt-1.5 break-words text-2xl font-semibold outline-none"
            >
              {result.checkpoint_name}
            </h1>
            <div className="mt-2">
              <GuardVisitMeta
                area={result.area_name}
                time={new Intl.DateTimeFormat("es-GT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: timezone,
                }).format(new Date(result.recorded_at))}
              />
            </div>
            <p className="mt-3 text-sm font-medium text-secondary-foreground">
              {result.progress.visited} de {result.progress.total}{" "}
              {result.progress.total === 1
                ? "punto registrado"
                : "puntos registrados"}
            </p>
            {completed && (
              <p className="mt-1 font-semibold text-secondary-foreground">
                Ronda completada
              </p>
            )}
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            {completed ? (
              evidenceNeedsAttention ? (
                <button type="button" disabled className={guardPrimary}>
                  Volver al inicio
                </button>
              ) : (
                <Link href="/app" className={guardPrimary}>
                  Volver al inicio
                </Link>
              )
            ) : (
              <button
                type="button"
                className={guardPrimary}
                disabled={!online || evidenceNeedsAttention}
                onClick={() => void prepare()}
              >
                <QrCode className="size-5" aria-hidden="true" /> Escanear
                siguiente punto
              </button>
            )}
            {evidenceAvailable && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-semibold">Evidencia opcional</p>
                <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-12 justify-start px-2.5"
                    aria-expanded={noteOpen}
                    disabled={!!evidencePending}
                    onClick={() => {
                      if (noteOpen) setNote(savedNote);
                      setNoteOpen(!noteOpen);
                    }}
                  >
                    <FileText className="size-4" aria-hidden="true" />{" "}
                    {savedNote ? "Editar observación" : "Añadir observación"}
                  </Button>
                  {!photoSaved ? (
                    <label
                      className={`${guardSecondary} relative justify-start border px-2.5 focus-within:ring-2 focus-within:ring-ring ${!online || evidencePending ? "opacity-60" : "cursor-pointer"}`}
                    >
                      <ImagePlus
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />{" "}
                      Añadir foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        aria-label="Añadir foto"
                        className="sr-only"
                        disabled={!online || !!evidencePending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void uploadPhoto(file);
                        }}
                      />
                    </label>
                  ) : (
                    <p className="flex min-h-12 items-center gap-2 px-2.5 text-sm font-semibold text-secondary-foreground">
                      <CheckCircle2 className="size-4" aria-hidden="true" />{" "}
                      Foto adjunta
                    </p>
                  )}
                </div>
                {noteOpen && (
                  <div className="space-y-2">
                    <label htmlFor="guard-note" className="text-sm font-medium">
                      Observación
                    </label>
                    <Textarea
                      ref={noteInput}
                      id="guard-note"
                      placeholder="¿Algo que reportar?"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={1000}
                      className="mt-1 text-base"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="h-12"
                        disabled={!online || !!evidencePending || !note.trim()}
                        onClick={() => void saveNote()}
                      >
                        Guardar observación
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-12"
                        disabled={!!evidencePending}
                        onClick={() => {
                          setNote(savedNote);
                          setNoteOpen(false);
                          setEvidenceError("");
                        }}
                      >
                        Cancelar edición
                      </Button>
                    </div>
                  </div>
                )}
                {evidencePending && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {evidencePending === "photo"
                      ? "Adjuntando fotografía…"
                      : "Guardando observación…"}
                  </p>
                )}
                {evidenceMessage && (
                  <p
                    role="status"
                    className="text-sm font-medium text-secondary-foreground"
                  >
                    {evidenceMessage}
                  </p>
                )}
                {evidenceError && (
                  <p role="alert" className="text-sm text-destructive">
                    {evidenceError} El punto sigue registrado.
                  </p>
                )}
                {photoToRetry && !evidencePending && (
                  <Button
                    variant="outline"
                    className="h-12"
                    disabled={!online}
                    onClick={() => void uploadPhoto(photoToRetry)}
                  >
                    Reintentar foto
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
