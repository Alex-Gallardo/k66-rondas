import { redirect } from "next/navigation";
import { QrCode, ShieldCheck } from "lucide-react";
import { getActor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) {
    redirect(
      actor.mustChangePassword
        ? "/change-password"
        : actor.role === "guard"
          ? "/app"
          : "/admin",
    );
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:px-10">
      <div className="hidden lg:block">
        <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <QrCode className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          K66 Rondas
        </p>
        <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight tracking-tight">
          Cada recorrido empieza con tu cuenta.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
          Tu nombre queda ligado a cada registro. Al cambiar de guardia, cierra
          sesión para entregar el dispositivo con tranquilidad.
        </p>
        <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          Acceso personal para dispositivos compartidos
        </div>
      </div>
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </div>
          <span className="text-xl font-semibold tracking-tight">
            K66 Rondas
          </span>
        </div>
        <p className="text-sm font-semibold text-primary">Bienvenido 👋</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Tu ronda empieza aquí
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ingresa tu código de empleado y contraseña personal.
        </p>
        <LoginForm />
        <p className="mt-7 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          ¿Olvidaste tu contraseña? Solicita un restablecimiento presencial a tu
          administrador.
        </p>
      </div>
    </main>
  );
}
