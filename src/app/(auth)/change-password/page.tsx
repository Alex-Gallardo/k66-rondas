import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getActor } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function ChangePasswordPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-5 py-10">
      <div className="w-full rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <LockKeyhole className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-7 text-sm font-semibold text-primary">
          Hola, {actor.fullName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Crea tu contraseña personal
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Esta cuenta identificará tus recorridos. Usa al menos 10 caracteres y
          no compartas la contraseña con el siguiente turno.
        </p>
        <PasswordForm />
      </div>
    </main>
  );
}
