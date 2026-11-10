import Link from "next/link";
import { QrCode, ArrowLeft } from "lucide-react";

export default function ScanLanding() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <div className="w-full rounded-[2rem] border bg-card p-7 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <QrCode className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight">
          Punto QR preparado
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Este código ya pertenece al inventario de K66 Rondas. El registro de
          visitas con el teléfono se habilitará en la siguiente fase.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Ir al acceso
        </Link>
      </div>
    </main>
  );
}
