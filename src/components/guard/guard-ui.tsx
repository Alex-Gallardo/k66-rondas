import type { ReactNode } from "react";
import { Check, Circle, Clock3, MapPin } from "lucide-react";

export const guardPage =
  "mx-auto min-h-dvh w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6";

export const guardDockSpace =
  "pb-[calc(7rem+env(safe-area-inset-bottom))] [&_a]:scroll-mb-[calc(7rem+env(safe-area-inset-bottom))] [&_button]:scroll-mb-[calc(7rem+env(safe-area-inset-bottom))]";

export const guardPrimary =
  "inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 py-2 text-center text-base font-semibold text-primary-foreground shadow-sm outline-none motion-safe:transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none";

export const guardSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold outline-none motion-safe:transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring";

export function GuardActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,61,50,0.07)]">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6">{children}</div>
    </div>
  );
}

export function RouteProgress({
  visited,
  total,
  requiredLeft,
}: {
  visited: number;
  total: number;
  requiredLeft: number;
}) {
  const summary = `${visited} de ${total} ${total === 1 ? "punto registrado" : "puntos registrados"}`;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-white">
        <strong className="text-2xl font-semibold tracking-tight tabular-nums">
          {visited}/{total}
        </strong>
        <span className="text-sm">
          {total === 1 ? "punto registrado" : "puntos registrados"}
        </span>
      </p>
      <progress
        className="mt-2 block h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#98eacb] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-white/20 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#98eacb]"
        max={total || 1}
        value={visited}
        aria-label={summary}
      />
      <p className="mt-2 text-sm text-[#d4f1e5]">
        {requiredLeft === 0
          ? "Sin puntos obligatorios pendientes"
          : requiredLeft === 1
            ? "1 punto obligatorio pendiente"
            : `${requiredLeft} puntos obligatorios pendientes`}
      </p>
    </div>
  );
}

export function RoutePoint({
  name,
  area,
  visited,
  required,
}: {
  name: string;
  area?: string;
  visited: boolean;
  required: boolean;
}) {
  const Icon = visited ? Check : Circle;
  return (
    <li className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:px-4">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full ${visited ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{name}</p>
        {area && (
          <p className="break-words text-xs text-muted-foreground">{area}</p>
        )}
      </div>
      <span
        className={`max-w-[7rem] text-right text-xs font-semibold ${visited ? "text-secondary-foreground" : "text-muted-foreground"}`}
      >
        {visited ? "Registrado" : "Pendiente"}
        {!required && (
          <span className="block font-normal text-muted-foreground">
            Opcional
          </span>
        )}
      </span>
    </li>
  );
}

export function GuardVisitMeta({ area, time }: { area: string; time: string }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <span className="flex min-w-0 items-start gap-1.5">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="break-words">{area}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock3 aria-hidden="true" className="size-4" />
        {time}
      </span>
    </div>
  );
}
