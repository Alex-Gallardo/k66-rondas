"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Occurrence } from "@/lib/notifications/data";
import {
  assignmentIssues,
  formatPatrolDate,
  occurrenceLabels,
} from "@/lib/notifications/labels";

export type ScheduleRule = {
  id: string;
  gate_id: string;
  template_id: string;
  guard_id: string;
  weekdays: number[];
  local_time: string;
  starts_on: string;
  ends_on: string | null;
  advance_minutes: number;
  start_grace_minutes: number;
  finish_minutes: number;
  notify_at_start: boolean;
  active: boolean;
};
export type ScheduleGate = {
  id: string;
  name: string;
  sites: { name: string; timezone: string };
};
export type ScheduleTemplate = { id: string; name: string; gate_id: string };
export type ScheduleGuard = {
  id: string;
  full_name: string;
  employee_code: string;
  gateIds: string[];
};

const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fieldClass =
  "min-h-11 w-full rounded-xl border bg-background px-3 text-sm";

function dayInZone(zone: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function exampleDates(
  start: string,
  end: string,
  weekdays: number[],
  zone: string,
) {
  const from = new Date(`${[start, dayInZone(zone)].sort()[1]}T12:00:00Z`);
  if (Number.isNaN(from.valueOf())) return [];
  const days: string[] = [];
  for (let step = 0; step < 14 && days.length < 4; step += 1) {
    const day = from.toISOString().slice(0, 10);
    if (end && day > end) break;
    if (weekdays.includes(from.getUTCDay() || 7)) days.push(day);
    from.setUTCDate(from.getUTCDate() + 1);
  }
  return days;
}

function guardLabel(guard: ScheduleGuard) {
  return `${guard.full_name} · ${guard.employee_code}`;
}

function ScheduleEditor({
  existing,
  gates,
  templates,
  guards,
  pending,
  save,
  cancel,
}: {
  existing: ScheduleRule | null;
  gates: ScheduleGate[];
  templates: ScheduleTemplate[];
  guards: ScheduleGuard[];
  pending: boolean;
  save: (data: unknown) => void;
  cancel: () => void;
}) {
  const [gateId, setGateId] = useState(existing?.gate_id ?? "");
  const [templateId, setTemplateId] = useState(existing?.template_id ?? "");
  const [guardId, setGuardId] = useState(existing?.guard_id ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? []);
  const [start, setStart] = useState(existing?.starts_on ?? "");
  const [end, setEnd] = useState(existing?.ends_on ?? "");
  const [time, setTime] = useState(existing?.local_time.slice(0, 5) ?? "");
  const zone = gates.find((gate) => gate.id === gateId)?.sites.timezone;
  const preview =
    zone && start && time ? exampleDates(start, end, weekdays, zone) : [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save({
      action: "save",
      id: existing?.id ?? null,
      active: existing?.active ?? true,
      rule: {
        gate_id: gateId,
        template_id: templateId,
        guard_id: guardId,
        weekdays,
        local_time: time,
        starts_on: start,
        ends_on: end || null,
        advance_minutes: Number(form.get("advance")),
        start_grace_minutes: Number(form.get("grace")),
        finish_minutes: Number(form.get("finish")),
        notify_at_start: form.has("due"),
      },
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">
        {existing ? "Editar regla" : "Programar rondas"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium">
          Garita
          <select
            aria-label="Garita"
            required
            className={fieldClass}
            value={gateId}
            onChange={(event) => {
              setGateId(event.target.value);
              setTemplateId("");
              setGuardId("");
            }}
          >
            <option value="">Elige una garita</option>
            {gates.map((gate) => (
              <option value={gate.id} key={gate.id}>
                {gate.sites.name} · {gate.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Recorrido
          <select
            aria-label="Recorrido"
            required
            disabled={!gateId}
            className={fieldClass}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Elige un recorrido</option>
            {templates
              .filter((item) => item.gate_id === gateId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Guardia responsable
          <select
            aria-label="Guardia responsable"
            required
            disabled={!gateId}
            className={fieldClass}
            value={guardId}
            onChange={(event) => setGuardId(event.target.value)}
          >
            <option value="">Elige un guardia</option>
            {guards
              .filter((item) => item.gateIds.includes(gateId))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {guardLabel(item)}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Hora local
          <input
            required
            type="time"
            className={fieldClass}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Vigente desde
          <input
            required
            type="date"
            className={fieldClass}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Vigente hasta (opcional)
          <input
            type="date"
            min={start || undefined}
            className={fieldClass}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Días de ronda</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {dayNames.map((label, index) => (
            <label
              className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm has-checked:bg-secondary"
              key={label}
            >
              <input
                type="checkbox"
                checked={weekdays.includes(index + 1)}
                onChange={(event) =>
                  setWeekdays(
                    event.target.checked
                      ? [...weekdays, index + 1]
                      : weekdays.filter((item) => item !== index + 1),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {preview.length > 0 && (
        <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          Próximas fechas locales · {preview.join(", ")} · {time} ({zone})
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium">
          Aviso antes (min)
          <input
            required
            type="number"
            min="1"
            max="120"
            name="advance"
            defaultValue={existing?.advance_minutes ?? 10}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Margen para iniciar (min)
          <input
            required
            type="number"
            min="1"
            max="120"
            name="grace"
            defaultValue={existing?.start_grace_minutes ?? 15}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Plazo para terminar (min)
          <input
            required
            type="number"
            min="1"
            max="240"
            name="finish"
            defaultValue={existing?.finish_minutes ?? 30}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="due"
          defaultChecked={existing?.notify_at_start}
        />{" "}
        Volver a avisar a la hora prevista
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !weekdays.length}>
          Guardar regla
        </Button>
        {existing && (
          <Button variant="ghost" type="button" onClick={cancel}>
            Cancelar edición
          </Button>
        )}
      </div>
    </form>
  );
}

export function PatrolSchedules({
  editable,
  gates,
  rules,
  templates,
  guards,
  occurrences,
  checkedAt,
}: {
  editable: boolean;
  gates: ScheduleGate[];
  rules: ScheduleRule[];
  templates: ScheduleTemplate[];
  guards: ScheduleGuard[];
  occurrences: Occurrence[];
  checkedAt: number;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<ScheduleRule | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [change, setChange] = useState<{
    id: string;
    guard: string;
    mode: "assign" | "cancel";
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(data: unknown) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/patrol-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "No pudimos guardar el cambio.",
        );
      setEdit(null);
      setChange(null);
      setFormVersion((version) => version + 1);
      setMessage("Programación actualizada.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && !(cause instanceof TypeError)
          ? cause.message
          : "No pudimos conectar. Intenta de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-xl border bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground"
        >
          {message}
        </p>
      )}
      {editable && (
        <ScheduleEditor
          key={`${edit?.id ?? "new"}-${formVersion}`}
          existing={edit}
          gates={gates}
          templates={templates}
          guards={guards}
          pending={pending}
          save={(values) => void submit(values)}
          cancel={() => setEdit(null)}
        />
      )}
      {editable && rules.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Reglas</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {rules.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4"
              >
                <div>
                  <p className="font-medium">
                    {templates.find(
                      (template) => template.id === item.template_id,
                    )?.name ?? "Recorrido archivado"}{" "}
                    · {item.local_time.slice(0, 5)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {gates.find((gate) => gate.id === item.gate_id)?.name ??
                      "Garita archivada"}{" "}
                    · {item.weekdays.map((day) => dayNames[day - 1]).join(", ")}{" "}
                    · {item.active ? "Activa" : "Pausada"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => setEdit(item)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      void submit({
                        action: "toggle",
                        id: item.id,
                        active: !item.active,
                      })
                    }
                  >
                    {item.active ? "Pausar" : "Reactivar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Agenda de rondas</h2>
        {occurrences.length === 0 && (
          <p className="rounded-xl border bg-card p-4 text-sm">
            No hay rondas programadas en el período.
          </p>
        )}
        {occurrences.map((item) => (
          <article
            key={item.id}
            className="space-y-2 rounded-2xl border bg-card p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {item.gate.name} · {item.template.name}
              </h3>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                {occurrenceLabels[item.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatPatrolDate(item.scheduled_at, item.timezone)} ·{" "}
              {item.guard?.full_name ?? "Sin guardia"}
            </p>
            {item.assignment_issue && (
              <p className="text-sm text-destructive">
                {assignmentIssues[item.assignment_issue]}
              </p>
            )}
            {editable &&
              ["scheduled", "unassigned"].includes(item.status) &&
              Date.parse(item.start_until) > checkedAt &&
              (change?.id === item.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  {change.mode === "assign" && (
                    <label className="grid gap-1 text-sm font-medium">
                      Nuevo guardia
                      <select
                        className={fieldClass}
                        value={change.guard}
                        onChange={(event) =>
                          setChange({ ...change, guard: event.target.value })
                        }
                      >
                        <option value="">Elige un guardia</option>
                        {guards
                          .filter((guard) =>
                            guard.gateIds.includes(item.gate_id),
                          )
                          .map((guard) => (
                            <option key={guard.id} value={guard.id}>
                              {guardLabel(guard)}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {change.mode === "cancel" && (
                    <p className="basis-full text-sm">
                      Cancelar esta ronda retira sus avisos pendientes.
                    </p>
                  )}
                  <Button
                    disabled={
                      pending || (change.mode === "assign" && !change.guard)
                    }
                    onClick={() =>
                      void submit({
                        action:
                          change.mode === "assign" ? "reassign" : "cancel",
                        id: item.id,
                        guard: change.guard,
                      })
                    }
                  >
                    Confirmar
                  </Button>
                  <Button variant="ghost" onClick={() => setChange(null)}>
                    Volver
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.assignment_issue !== "local_time_unavailable" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setChange({ id: item.id, guard: "", mode: "assign" })
                      }
                    >
                      Reasignar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setChange({ id: item.id, guard: "", mode: "cancel" })
                    }
                  >
                    Cancelar ronda
                  </Button>
                </div>
              ))}
          </article>
        ))}
      </section>
    </div>
  );
}
