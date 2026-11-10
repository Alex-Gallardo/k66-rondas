import type { ReactNode } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireActor(["admin", "supervisor"]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-border bg-card px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
        <Link href="/admin" className="mb-5 flex items-center gap-3 lg:mb-9">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <span>
            <strong className="block text-base leading-5">K66 Rondas</strong>
            <small className="text-xs text-muted-foreground">
              Panel de administración
            </small>
          </span>
        </Link>
        <AdminNav role={actor.role} />
        <div className="mt-6 hidden rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground lg:block">
          <p className="font-semibold">Trabajo claro, punto por punto.</p>
          <p className="mt-2 text-xs leading-5">
            Configura la planta antes de iniciar las rondas.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/70 px-5 py-3 sm:px-8">
          <div>
            <p className="text-xs text-muted-foreground">Sesión actual</p>
            <p className="font-semibold">
              {actor.fullName}{" "}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {actor.role === "admin" ? "Administrador" : "Supervisor"}
              </span>
            </p>
          </div>
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
