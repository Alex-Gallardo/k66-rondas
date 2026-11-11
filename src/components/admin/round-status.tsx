import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";

const states = {
  in_progress: {
    label: "En curso",
    icon: CircleDashed,
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  completed: {
    label: "Completada",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  incomplete: {
    label: "Incompleta",
    icon: TriangleAlert,
    className: "bg-amber-50 text-amber-900 ring-amber-200",
  },
} as const;

export function RoundStatus({ status }: { status: string }) {
  const state = states[status as keyof typeof states] ?? states.in_progress;
  const Icon = state.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${state.className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" /> {state.label}
    </span>
  );
}
