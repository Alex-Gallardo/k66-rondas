import { DoorOpen, QrCode, UserRound } from "lucide-react";
import { assignedGateIds, requireActor } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { LogoutButton } from "@/components/shared/logout-button";

export default async function GuardHome() {
  const actor = await requireActor(["guard"]);
  const gateIds = await assignedGateIds(actor);
  const db = createAdminSupabase();
  const { data: gates } = gateIds.length
    ? await db
        .from("gates")
        .select("id,name,code")
        .in("id", gateIds)
        .eq("active", true)
    : { data: [] };

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <strong>K66 Rondas</strong>
        </div>
        <LogoutButton />
      </header>
      <section className="mt-10 rounded-[2rem] bg-[#103d32] p-7 text-white">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <UserRound className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-7 text-sm text-[#cce6d9]">
          Cuenta personal · {actor.employeeCode}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Hola, {actor.fullName.split(" ")[0]} 👋
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#d3e9de]">
          Tu nombre identificará cada ronda que registres. Comprueba siempre que
          esta sea tu cuenta antes de usar un dispositivo compartido.
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Tus garitas</h2>
        <div className="mt-4 space-y-3">
          {gates?.map((gate) => (
            <div
              key={gate.id}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <DoorOpen className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">{gate.name}</p>
                <p className="text-xs text-muted-foreground">{gate.code}</p>
              </div>
            </div>
          ))}
        </div>
        {!gates?.length && (
          <p className="mt-4 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            Aún no tienes una garita asignada. Solicita acceso a tu
            administrador.
          </p>
        )}
      </section>
      <p className="mt-8 rounded-2xl bg-secondary p-5 text-sm leading-6 text-secondary-foreground">
        El inicio de turno y el lector QR estarán disponibles al completar la
        Fase 3.
      </p>
    </main>
  );
}
