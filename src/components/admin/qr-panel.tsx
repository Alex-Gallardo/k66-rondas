"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type QrInfo = {
  id: string;
  code: string;
  name: string;
  area: string;
  url: string;
  version: number;
};

export function QrPanel({
  pointId,
  onClose,
}: {
  pointId: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const localUrl = qr
    ? ["localhost", "127.0.0.1", "::1"].includes(new URL(qr.url).hostname)
    : false;

  async function load() {
    const response = await fetch(`/api/admin/checkpoints/${pointId}/qr`);
    const result = await response.json();
    if (response.ok) setQr(result);
    else setError(result.error?.message ?? "No pudimos cargar el QR.");
  }

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/checkpoints/${pointId}/qr`)
      .then((response) =>
        response.json().then((result) => ({ response, result })),
      )
      .then(({ response, result }) => {
        if (cancelled) return;
        if (response.ok) setQr(result);
        else setError(result.error?.message ?? "No pudimos cargar el QR.");
      });
    return () => {
      cancelled = true;
    };
  }, [pointId]);

  async function rotate() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/checkpoints/${pointId}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "No pudimos rotar el QR.");
      setConfirm(false);
      setReason("");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos rotar el QR.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="mt-6 rounded-[1.5rem] border border-primary/20 bg-secondary/40 p-5"
      aria-label="Etiqueta QR"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">
            Etiqueta imprimible
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {qr?.name ?? "Cargando QR…"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {qr?.area} · {qr?.code} · versión {qr?.version}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar etiqueta"
          className="flex size-10 items-center justify-center rounded-xl hover:bg-card"
        >
          <X className="size-5" />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {qr && (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <Image
            key={qr.version}
            src={`/api/admin/checkpoints/${pointId}/qr?format=svg`}
            alt={`QR de ${qr.name}`}
            width={208}
            height={208}
            unoptimized
            className="size-52 rounded-xl border bg-white p-2"
          />
          <div className="min-w-0 space-y-3">
            <p className="break-all text-xs text-muted-foreground">{qr.url}</p>
            {localUrl && (
              <p
                role="alert"
                className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900"
              >
                Esta etiqueta apunta a una dirección local. Configura
                APP_BASE_URL con la URL pública antes de imprimirla para la
                fábrica.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/admin/checkpoints/${pointId}/qr?format=pdf`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" /> PDF para
                imprimir
              </a>
              <a
                href={`/api/admin/checkpoints/${pointId}/qr?format=svg&download=1`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium"
              >
                <Download className="size-4" aria-hidden="true" /> SVG
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Reimprimir mantiene el mismo QR. Coloca la etiqueta en su punto
              antes de marcarla como verificada.
            </p>
          </div>
        </div>
      )}
      {qr && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="max-w-md space-y-2">
            <Label htmlFor="rotation-reason">Motivo de rotación</Label>
            <Input
              id="rotation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Papel perdido o código divulgado"
              maxLength={300}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={reason.trim().length < 4}
            onClick={() => setConfirm(true)}
          >
            <RotateCw className="size-4" aria-hidden="true" /> Rotar QR
          </Button>
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800">
              <RotateCw className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Rotar este QR?</AlertDialogTitle>
            <AlertDialogDescription>
              El código impreso dejará de ser válido. Imprime y coloca la
              versión nueva antes de usar el punto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={rotate}>
              {pending ? "Rotando…" : "Confirmar rotación"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
