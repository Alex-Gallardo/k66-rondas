import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, CalendarClock } from "lucide-react";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { guardPage, guardSecondary } from "@/components/guard/guard-ui";
import { MarkNotice } from "@/components/guard/mark-notice";
import { PushSettings } from "@/components/guard/push-settings";
import {
  getGuardAgenda,
  getGuardNotices,
  occurrenceColumns,
  type Occurrence,
} from "@/lib/notifications/data";
import {
  formatPatrolDate,
  noticeLabels,
  occurrenceLabels,
} from "@/lib/notifications/labels";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

function AgendaItem({ item, now }: { item: Occurrence; now: number }) {
  const canStart =
    item.status === "scheduled" &&
    Date.parse(item.remind_at) <= now &&
    Date.parse(item.start_until) > now;
  const isMissed =
    item.status === "scheduled" && Date.parse(item.start_until) <= now;
  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{item.template.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.gate.name} ·{" "}
            {formatPatrolDate(item.scheduled_at, item.timezone)}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          {occurrenceLabels[isMissed ? "missed" : item.status]}
        </span>
      </div>
      {canStart || item.status === "in_progress" ? (
        <Link
          href={`/app/scan?occurrence=${item.id}`}
          className={`${guardSecondary} mt-2 border text-primary`}
        >
          {canStart ? "Escanear QR de esta ronda" : "Continuar escaneando"}
        </Link>
      ) : item.status === "scheduled" && !isMissed ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Puedes iniciar desde {formatPatrolDate(item.remind_at, item.timezone)}
          .
        </p>
      ) : null}
    </article>
  );
}

export default async function GuardNotices({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const id = z.uuid().safeParse(aviso);
  const actor = await getActor();
  if (!actor)
    redirect(
      id.success
        ? `/login?next=${encodeURIComponent(`/app/avisos?aviso=${id.data}`)}`
        : "/login",
    );
  if (actor.mustChangePassword) redirect("/change-password");
  if (actor.role !== "guard") redirect("/admin");

  const [notices, agenda] = await Promise.all([
    getGuardNotices(actor.id),
    getGuardAgenda(actor.id),
  ]);
  const selected = id.success
    ? notices.find((item) => item.id === id.data)
    : undefined;
  let detail: Occurrence | null = null;
  if (selected?.occurrence_id) {
    const result = await createAdminSupabaseUntyped()
      .from("patrol_occurrences")
      .select(occurrenceColumns)
      .eq("id", selected.occurrence_id)
      .eq("guard_id", actor.id)
      .maybeSingle();
    if (!result.error) detail = result.data as unknown as Occurrence | null;
  }
  const now = new Date().getTime();

  return (
    <main className={`${guardPage} space-y-5 pb-10`}>
      <header className="flex items-center justify-between gap-3">
        <Link href="/app" className={guardSecondary}>
          <ArrowLeft size={20} aria-hidden="true" /> Inicio
        </Link>
        <strong className="text-sm">K66 Rondas</strong>
      </header>
      <h1 className="text-2xl font-semibold">Avisos</h1>
      {id.success && (
        <section
          aria-label="Aviso seleccionado"
          className="space-y-2 rounded-2xl border bg-secondary p-4"
        >
          {selected && !selected.read_at && <MarkNotice id={selected.id} />}
          <p className="font-medium">
            {selected
              ? noticeLabels[selected.kind]
              : "Este aviso ya no está disponible para tu cuenta."}
          </p>
          {detail && <AgendaItem item={detail} now={now} />}
          {selected?.occurrence_id && !detail && (
            <p className="text-sm">Consulta tu agenda actual.</p>
          )}
        </section>
      )}
      <section id="agenda" className="scroll-mt-3 space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarClock size={18} aria-hidden="true" /> Rondas programadas
        </h2>
        {agenda.length ? (
          agenda.map((item) => (
            <AgendaItem key={item.id} item={item} now={now} />
          ))
        ) : (
          <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Aún no tienes rondas programadas.
          </p>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bell size={18} aria-hidden="true" /> Bandeja
        </h2>
        {notices.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link
                  href={`/app/avisos?aviso=${notice.id}`}
                  prefetch={false}
                  className="block min-h-12 rounded-xl px-4 py-3 focus-visible:outline-2"
                >
                  <span className="block text-sm font-medium">
                    {noticeLabels[notice.kind] ?? "Aviso de ronda"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatPatrolDate(notice.created_at, "America/Guatemala")}
                    {notice.cancelled_at
                      ? " · Actualizado"
                      : !notice.read_at && selected?.id !== notice.id
                        ? " · Nuevo"
                        : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Aún no tienes avisos.
          </p>
        )}
      </section>
      <PushSettings />
    </main>
  );
}
