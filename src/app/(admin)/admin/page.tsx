import Link from "next/link";
import {
  ArrowRight,
  Building2,
  DoorOpen,
  MapPinned,
  QrCode,
  Route,
  Users,
} from "lucide-react";
import { requireActor, assignedGateIds } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export default async function AdminHome() {
  const actor = await requireActor(["admin", "supervisor"]);
  const db = createAdminSupabase();
  const gateIds =
    actor.role === "supervisor" ? await assignedGateIds(actor) : [];

  if (actor.role === "supervisor") {
    const { data: gates } = gateIds.length
      ? await db
          .from("gates")
          .select("id,name,code")
          .in("id", gateIds)
          .eq("active", true)
      : { data: [] };
    return (
      <div>
        <p className="text-sm font-semibold text-primary">
          Panel de supervisor
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Hola, {actor.fullName.split(" ")[0]} 👋
        </h1>
        <p className="mt-3 text-muted-foreground">
          Estas son las garitas asignadas a tu cuenta. Consulta los registros de
          ronda desde la sección Registros.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {gates?.map((gate) => (
            <div key={gate.id} className="rounded-2xl border bg-card p-5">
              <DoorOpen className="size-5 text-primary" aria-hidden="true" />
              <p className="mt-4 font-semibold">{gate.name}</p>
              <p className="text-sm text-muted-foreground">{gate.code}</p>
            </div>
          ))}
        </div>
        {!gates?.length && (
          <p className="mt-8 rounded-2xl border bg-card p-6 text-muted-foreground">
            Aún no tienes garitas asignadas. Solicita acceso al administrador.
          </p>
        )}
      </div>
    );
  }

  const [sites, gates, areas, points, users, templates] = await Promise.all([
    db
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("gates")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("areas")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("checkpoints")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("patrol_templates")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const cards = [
    {
      label: "Sedes",
      count: sites.count,
      href: "/admin/sites",
      icon: Building2,
    },
    {
      label: "Garitas",
      count: gates.count,
      href: "/admin/gates",
      icon: DoorOpen,
    },
    {
      label: "Áreas",
      count: areas.count,
      href: "/admin/areas",
      icon: MapPinned,
    },
    {
      label: "Puntos QR",
      count: points.count,
      href: "/admin/checkpoints",
      icon: QrCode,
    },
    {
      label: "Usuarios",
      count: users.count,
      href: "/admin/users",
      icon: Users,
    },
    {
      label: "Plantillas",
      count: templates.count,
      href: "/admin/templates",
      icon: Route,
    },
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-primary">
        Configuración de planta
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Todo listo para organizar las rondas
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Prepara sedes, garitas, áreas, puntos y personas. Cada QR quedará ligado
        a un punto físico específico.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <card.icon className="size-5" aria-hidden="true" />
              </span>
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </div>
            <p className="mt-5 text-3xl font-semibold tabular-nums">
              {card.count ?? "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.label} activos
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-primary/20 bg-secondary p-6">
        <h2 className="font-semibold">Orden recomendado</h2>
        <p className="mt-2 text-sm leading-6 text-secondary-foreground">
          1. Crea la sede y las garitas. 2. Define áreas y puntos QR. 3. Asigna
          personas a garitas. 4. Prepara las plantillas de ronda.
        </p>
      </div>
    </div>
  );
}
