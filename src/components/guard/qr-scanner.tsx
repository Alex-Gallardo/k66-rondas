"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  MapPin,
  MapPinOff,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
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

type VisitResult = {
  outcome: "recorded" | "idempotent" | "already_scanned";
  visit_id: string;
  recorded_at: string;
  checkpoint_name: string;
  area_name: string;
  progress: { visited: number; total: number };
  patrol_status: "in_progress" | "completed" | "incomplete";
};
type Phase = "preparing" | "camera" | "saving" | "success" | "error";

export function QrScanner({ initialCode }: { initialCode?: string }) {
  const online = useOnlineStatus();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ code: string; key: string } | null>(null);
  const [timezone, setTimezone] = useState("America/Guatemala");
  const [phase, setPhase] = useState<Phase>("preparing");
  const [error, setError] = useState("");
  const [result, setResult] = useState<VisitResult | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [locationIssue, setLocationIssue] = useState<
    "denied" | "timeout" | "unavailable" | null
  >(null);
  const [note, setNote] = useState("");
  const [evidencePending, setEvidencePending] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidenceError, setEvidenceError] = useState("");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const saveCode = useCallback(
    async (raw: string, retry = false) => {
      if (busyRef.current) return;
      const code = parseQrCode(raw);
      if (!code) {
        setError("No reconocemos este punto QR. Prueba con otra etiqueta.");
        setPhase("error");
        setCanRetry(false);
        return;
      }
      busyRef.current = true;
      stopCamera();
      setError("");
      setPhase("saving");
      const pending =
        retry && pendingRef.current?.code === code
          ? pendingRef.current
          : { code, key: crypto.randomUUID() };
      pendingRef.current = pending;
      try {
        if (!navigator.onLine)
          throw new Error(
            "Sin conexión. Vuelve a intentarlo cuando haya internet; este QR aún no se guardó.",
          );
        const geo = await captureLocation();
        if (geo.status !== "captured") {
          setLocationIssue(geo.status);
          throw new Error(
            "La ubicación GPS es obligatoria. Activa la ubicación del teléfono y permite el acceso a este sitio. El punto no se guardó.",
          );
        }
        const response = await fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr_code: code,
            idempotency_key: pending.key,
            geo,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401)
            throw new Error(
              "Tu sesión terminó. Inicia sesión y vuelve a escanear.",
            );
          if (data.error?.code === "GEO_REQUIRED")
            setLocationIssue("unavailable");
          throw new Error(
            data.error?.message ?? "No pudimos guardar la visita.",
          );
        }
        pendingRef.current = null;
        setResult(data as VisitResult);
        setNote("");
        setEvidenceMessage("");
        setEvidenceError("");
        setPhase("success");
        setCanRetry(false);
      } catch (cause) {
        setError(
          cause instanceof TypeError
            ? "No pudimos conectar con el servidor. Este QR aún no se guardó; reintenta cuando vuelva la red."
            : cause instanceof Error
              ? cause.message
              : "No pudimos guardar la visita.",
        );
        setPhase("error");
        setCanRetry(true);
      } finally {
        busyRef.current = false;
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(
    async (cancelled?: () => boolean) => {
      setError("");
      setPhase("camera");
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Este navegador no permite usar la cámara.");
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled?.() || !videoRef.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (scan, _error, activeControls) => {
            if (!scan || busyRef.current) return;
            activeControls.stop();
            void saveCode(scan.getText());
          },
        );
        if (cancelled?.()) controls.stop();
        else controlsRef.current = controls;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos abrir la cámara.",
        );
        setPhase("error");
        setCanRetry(false);
      }
    },
    [saveCode],
  );

  async function restartScanner() {
    setResult(null);
    setPhase("preparing");
    setError("");
    try {
      if (!navigator.onLine)
        throw new Error(
          "Sin conexión. Espera a que vuelva internet para escanear.",
        );
      const response = await fetch("/api/guard/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "No pudimos preparar la ronda.");
      setTimezone(data.timezone ?? "America/Guatemala");
      await startCamera();
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "No pudimos conectar con el servidor. Espera a que vuelva la red."
          : cause instanceof Error
            ? cause.message
            : "No pudimos preparar la ronda.",
      );
      setPhase("error");
      setCanRetry(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!navigator.onLine)
          throw new Error(
            "Sin conexión. Espera a que vuelva internet para escanear.",
          );
        const response = await fetch("/api/guard/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message ?? "No pudimos preparar la ronda.",
          );
        if (cancelled) return;
        setTimezone(data.timezone ?? "America/Guatemala");
        if (initialCode) await saveCode(initialCode);
        else await startCamera(() => cancelled);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof TypeError
            ? "No pudimos conectar con el servidor. Espera a que vuelva la red."
            : cause instanceof Error
              ? cause.message
              : "No pudimos preparar la ronda.",
        );
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [initialCode, saveCode, startCamera, stopCamera]);

  useEffect(() => {
    if (phase !== "camera") return;
    const handleOffline = () => {
      stopCamera();
      setError("Sin conexión. Espera a que vuelva internet para escanear.");
      setCanRetry(false);
      setPhase("error");
    };
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [phase, stopCamera]);

  async function saveNote() {
    if (!result || !note.trim()) return;
    setEvidencePending(true);
    setEvidenceError("");
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
      setEvidenceMessage("Observación guardada.");
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar la observación.",
      );
    } finally {
      setEvidencePending(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!result) return;
    setEvidencePending(true);
    setEvidenceError("");
    try {
      const compressed = await compressPhoto(file);
      const form = new FormData();
      form.append("photo", compressed, "ronda.jpg");
      const response = await fetch(`/api/visits/${result.visit_id}/photo`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "No pudimos adjuntar la foto.");
      setEvidenceMessage("Fotografía guardada.");
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error ? cause.message : "No pudimos adjuntar la foto.",
      );
    } finally {
      setEvidencePending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-20 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/app"
          onClick={stopCamera}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-secondary"
        >
          <ArrowLeft className="size-5" /> Volver
        </Link>
        <strong>K66 Rondas</strong>
      </header>
      <section className="mt-7">
        <p className="text-sm font-semibold text-primary">Registro de ronda</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Escanear QR
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apunta la cámara a la etiqueta del punto. Necesitamos tu ubicación GPS
          para guardar el registro.
        </p>
      </section>

      {(phase === "camera" || phase === "preparing") && (
        <div className="relative mt-6 overflow-hidden rounded-[2rem] bg-[#102720] aspect-[4/5] max-h-[65vh]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            aria-label="Vista de la cámara para leer QR"
          />
          {phase === "camera" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]"
            />
          )}
          {phase === "preparing" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
              Preparando turno y cámara…
            </p>
          )}
        </div>
      )}
      {phase === "camera" && (
        <p
          role="status"
          className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Camera className="size-4" /> Cámara activa · coloca el QR dentro del
          marco
        </p>
      )}
      {phase === "saving" && (
        <div
          role="status"
          className="mt-8 rounded-2xl bg-secondary p-6 text-center text-primary"
        >
          <RefreshCw className="mx-auto size-7 animate-spin" />
          <p className="mt-3 font-semibold">
            Obteniendo ubicación y guardando punto…
          </p>
          <p className="mt-1 text-sm">
            Espera la confirmación antes de continuar.
          </p>
        </div>
      )}
      {phase === "error" && (
        <div className="mt-8 rounded-2xl border bg-card p-6 text-center">
          {locationIssue || error.startsWith("La ubicación GPS") ? (
            <MapPinOff className="mx-auto size-8 text-destructive" />
          ) : (
            <WifiOff className="mx-auto size-8 text-destructive" />
          )}
          <p role="alert" className="mt-3 font-semibold">
            {error}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {canRetry && (
              <Button
                disabled={!online}
                onClick={() => {
                  const pending = pendingRef.current;
                  if (pending) void saveCode(pending.code, true);
                }}
              >
                {locationIssue || error.startsWith("La ubicación GPS")
                  ? "Reintentar ubicación"
                  : "Reintentar guardado"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!online}
              onClick={() => {
                pendingRef.current = null;
                void restartScanner();
              }}
            >
              Intentar otro QR
            </Button>
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      )}
      <AlertDialog
        open={locationIssue !== null}
        onOpenChange={(open) => {
          if (!open) setLocationIssue(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800">
              <MapPinOff className="size-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Activa la ubicación GPS</AlertDialogTitle>
            <AlertDialogDescription>
              {locationIssue === "denied"
                ? "Permite la ubicación para K66 Rondas en los ajustes del navegador y activa los servicios de ubicación del teléfono."
                : locationIssue === "timeout"
                  ? "No recibimos tu ubicación a tiempo. Activa GPS y verifica que el teléfono tenga señal."
                  : "Este dispositivo no entregó coordenadas. Activa la ubicación y permite el acceso a este sitio."}{" "}
              Este punto no se guardó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setLocationIssue(null)}>
              Entendido
            </Button>
            <Button
              disabled={!online}
              onClick={() => {
                const pending = pendingRef.current;
                setLocationIssue(null);
                if (pending) void saveCode(pending.code, true);
              }}
            >
              Reintentar GPS
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {phase === "success" && result && (
        <div className="mt-8 rounded-[2rem] border bg-card p-6 shadow-sm">
          <CheckCircle2 className="size-12 text-primary" />
          <p className="mt-4 text-sm font-semibold text-primary">
            {result.outcome === "already_scanned"
              ? "Ya registrado en esta ronda"
              : "Punto registrado"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            {result.checkpoint_name}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {result.area_name}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("es-GT", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: timezone,
            }).format(new Date(result.recorded_at))}
          </p>
          <p className="mt-5 rounded-xl bg-secondary p-4 font-semibold text-primary">
            {result.progress.visited} de {result.progress.total} puntos
            registrados{" "}
            {result.patrol_status === "completed"
              ? "· Ronda completada ✅"
              : ""}
          </p>
          {result.outcome === "recorded" && (
            <div className="mt-6 space-y-3 border-t pt-5">
              <p className="text-sm font-semibold">Evidencia opcional</p>
              <Textarea
                aria-label="Observación"
                placeholder="¿Algo que reportar?"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
              />
              <Button
                variant="outline"
                disabled={!online || evidencePending || !note.trim()}
                onClick={() => void saveNote()}
              >
                Guardar observación
              </Button>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-primary">
                <ImagePlus className="size-5" /> Añadir fotografía
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={!online || evidencePending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                  }}
                />
              </label>
              {evidenceMessage && (
                <p role="status" className="text-sm text-primary">
                  ✅ {evidenceMessage}
                </p>
              )}
              {evidenceError && (
                <p role="alert" className="text-sm text-destructive">
                  {evidenceError} La visita sigue registrada.
                </p>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={() => void restartScanner()}>
              Continuar escaneando
            </Button>
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border text-sm font-medium"
            >
              Ver mi ronda
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
