"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  HousePlus,
  Share2,
} from "lucide-react";

type Platform = "ios" | "android" | "desktop";

const subscribeOnce = () => () => {};

function getPlatform(): Platform {
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPage() {
  const platform = useSyncExternalStore(
    subscribeOnce,
    getPlatform,
    () => "desktop",
  );
  const installed = useSyncExternalStore(
    subscribeOnce,
    isInstalled,
    () => false,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-16 pt-6 sm:px-8">
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-secondary"
      >
        <ArrowLeft className="size-5" aria-hidden="true" /> Volver a K66 Rondas
      </Link>
      <div className="mt-8 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <HousePlus className="size-8" aria-hidden="true" />
      </div>
      <p className="mt-6 text-sm font-semibold text-primary">Acceso rápido</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Añadir a inicio
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Abre tus rondas desde un icono en el teléfono. La primera vez y cada
        registro necesitan conexión a internet.
      </p>
      {installed ? (
        <section
          className="mt-8 flex gap-3 rounded-2xl border bg-card p-5"
          role="status"
        >
          <CheckCircle2
            className="size-6 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">Ya está en tu inicio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes abrir K66 Rondas desde su icono.
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            {platform === "ios"
              ? "En iPhone o iPad"
              : platform === "android"
                ? "En Android"
                : "En tu navegador"}
          </h2>
          <ol className="mt-5 space-y-4 text-sm leading-6">
            {platform === "ios" ? (
              <>
                <li className="flex gap-3">
                  <Share2
                    className="mt-1 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>1.</strong> Abre esta página en Safari y toca{" "}
                    <strong>Compartir</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <HousePlus
                    className="mt-1 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>2.</strong> Elige{" "}
                    <strong>Agregar a pantalla de inicio</strong>.
                  </span>
                </li>
                <li>
                  <strong>3.</strong> Confirma con <strong>Agregar</strong> y
                  abre el icono K66 Rondas.
                </li>
              </>
            ) : platform === "android" ? (
              <>
                <li>
                  <strong>1.</strong> Abre esta página en Chrome y toca el menú
                  de tres puntos (⋮).
                </li>
                <li className="flex gap-3">
                  <Download
                    className="mt-1 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>2.</strong> Elige <strong>Instalar app</strong> o{" "}
                    <strong>Añadir a pantalla de inicio</strong>.
                  </span>
                </li>
                <li>
                  <strong>3.</strong> Confirma y abre el icono K66 Rondas.
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>1.</strong> Abre K66 Rondas en Chrome o Edge.
                </li>
                <li>
                  <strong>2.</strong> Usa el icono de instalación en la barra de
                  direcciones o el menú del navegador.
                </li>
                <li>
                  <strong>3.</strong> Confirma la instalación.
                </li>
              </>
            )}
          </ol>
        </section>
      )}
      <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
        Si pierdes señal, espera a recuperarla y vuelve a escanear. Un QR cuenta
        solo cuando ves «Punto registrado».
      </p>
    </main>
  );
}
