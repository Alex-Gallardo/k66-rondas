"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DeviceStatus = { active: boolean; publicKey: string | null };
type BrowserState = "checking" | "ready" | "unsupported" | "install" | "denied";
type BrowserPush = {
  manager: PushManager;
  subscription: PushSubscription | null;
};

function browserState(): BrowserState {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (
    ios &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    return "install";
  if (
    !window.isSecureContext ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  )
    return "unsupported";
  return Notification.permission === "denied" ? "denied" : "ready";
}

async function changeDevice(body: unknown) {
  const response = await fetch("/api/guard/notifications/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(
      result.error?.message ?? "No pudimos actualizar las notificaciones.",
    );
  }
}

export function PushSettings() {
  const [browser, setBrowser] = useState<BrowserState>("checking");
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [browserPush, setBrowserPush] = useState<BrowserPush | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/guard/notifications/device", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const status: DeviceStatus = await response.json();
        const state = browserState();
        if (state === "denied" && status.active) {
          await changeDevice({ action: "disable" });
          status.active = false;
        }
        if (controller.signal.aborted) return;
        setDevice(status);
        setBrowser(state);
        if (state === "ready" && status.publicKey) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (controller.signal.aborted) return;
          if (status.active && !subscription) {
            await changeDevice({ action: "disable" });
            if (controller.signal.aborted) return;
            setDevice({ ...status, active: false });
          }
          setBrowserPush({ manager: registration.pushManager, subscription });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBrowser(browserState());
          setError(
            "No pudimos consultar las notificaciones. Carga la página de nuevo.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  async function run(action: "subscribe" | "disable" | "test") {
    if (!device || pending) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (action === "subscribe" && device.publicKey && browserPush) {
        const base64 = device.publicKey.replace(/-/g, "+").replace(/_/g, "/");
        const key = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const existing = browserPush.subscription;
        if (existing) {
          const previousKey = existing.options.applicationServerKey;
          if (
            previousKey &&
            !new Uint8Array(previousKey).every(
              (value, index) => value === key[index],
            )
          ) {
            await existing.unsubscribe();
            setBrowserPush({ ...browserPush, subscription: null });
            setMessage(
              "Actualizamos el permiso de este dispositivo. Toca Activar notificaciones para continuar.",
            );
            return;
          }
        }
        // Safari requires subscribe() itself to start inside the button gesture.
        const subscription =
          existing ??
          (await browserPush.manager.subscribe({
            applicationServerKey: key,
            userVisibleOnly: true,
          }));
        await changeDevice({ action, ...subscription.toJSON() });
        setBrowserPush({ ...browserPush, subscription });
        setDevice({ ...device, active: true });
        setMessage(
          "Notificaciones activadas para tu cuenta en este dispositivo.",
        );
      } else if (action === "disable") {
        await changeDevice({ action });
        setDevice({ ...device, active: false });
        setMessage("Notificaciones desactivadas en este dispositivo.");
      } else if (action === "test") {
        await changeDevice({ action });
        setMessage(
          "Aviso de prueba en cola. Puede tardar hasta un minuto en empezar el envío.",
        );
      }
    } catch (cause) {
      if (action === "subscribe" && browserState() === "denied") {
        setBrowser("denied");
        setMessage("Puedes consultar los avisos en esta bandeja.");
        return;
      }
      setError(
        cause instanceof Error && !(cause instanceof TypeError)
          ? cause.message
          : "No pudimos actualizar las notificaciones. Revisa tu conexión.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="notificaciones"
      className="scroll-mt-3 rounded-2xl border bg-card p-4"
    >
      <h2 className="font-semibold">Notificaciones en este dispositivo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {browser === "checking"
          ? "Consultando disponibilidad…"
          : browser === "install"
            ? "Añade K66 Rondas al inicio del iPhone o iPad y abre la app desde el icono."
            : browser === "unsupported"
              ? "Este navegador no admite avisos Push. Puedes consultar la bandeja."
              : browser === "denied"
                ? "Las notificaciones están bloqueadas. Habilítalas en los ajustes del dispositivo o consulta la bandeja."
                : !device?.publicKey
                  ? "Los avisos Push aún no están habilitados en este entorno. Puedes consultar la bandeja."
                  : device.active
                    ? "Activas para tu cuenta."
                    : "Actívalas para recibir avisos de ronda mientras usas este dispositivo."}
      </p>
      {browser === "install" && (
        <Link
          href="/install"
          className="mt-2 inline-flex min-h-12 items-center text-sm font-semibold text-primary"
        >
          Ver cómo instalar la app
        </Link>
      )}
      {browser === "ready" && device?.publicKey && (
        <div className="mt-3 flex flex-wrap gap-2">
          {device.active ? (
            <>
              <Button
                className="h-12"
                variant="outline"
                disabled={pending}
                onClick={() => void run("disable")}
              >
                Desactivar
              </Button>
              <Button
                className="h-12"
                variant="secondary"
                disabled={pending}
                onClick={() => void run("test")}
              >
                Enviar aviso de prueba
              </Button>
            </>
          ) : (
            <Button
              className="h-12"
              disabled={pending || !browserPush}
              onClick={() => void run("subscribe")}
            >
              {browserPush
                ? "Activar notificaciones"
                : "Preparando notificaciones…"}
            </Button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-secondary-foreground">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
