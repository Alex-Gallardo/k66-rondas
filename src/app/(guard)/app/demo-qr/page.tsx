import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export default async function DemoQrPage() {
  const actor = await requireActor(["guard"]);
  if (actor.employeeCode !== "DEMO-001") return null;
  const db = createAdminSupabase();
  const { data: points, error } = await db
    .from("checkpoints")
    .select(
      "id,name,areas!inner(name,site_id,sites!inner(code)),qr_codes!inner(id,revoked_at)",
    )
    .eq("areas.sites.code", "K66-DEMO")
    .is("qr_codes.revoked_at", null)
    .order("name");
  if (error) throw error;
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-5 sm:px-6">
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-5" /> Volver
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">QR de demostración</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Abre esta página en una computadora y escanea los QR con el teléfono.
        También puedes imprimirlos.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {points?.map((point) => (
          <article
            key={point.id}
            className="rounded-2xl border bg-white p-5 text-center text-black"
          >
            <h2 className="font-semibold">{point.name}</h2>
            <p className="mt-1 text-sm">{point.areas.name}</p>
            <img
              src={`/api/demo/qrs/${point.qr_codes[0].id}`}
              alt={`QR de ${point.name}`}
              width="240"
              height="240"
              className="mx-auto mt-3 size-60"
            />
          </article>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Printer className="size-4" /> Para imprimir: Ctrl + P
      </p>
    </main>
  );
}
