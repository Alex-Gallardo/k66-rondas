export const noticeLabels: Record<string, string> = {
  upcoming: "Tienes una ronda próxima",
  due: "Es hora de iniciar tu ronda",
  missed: "La ronda quedó sin iniciar",
  pending: "Tu ronda tiene puntos pendientes",
  incomplete: "La ronda se cerró incompleta",
  assigned: "Tienes una ronda asignada",
  cancelled: "La programación de una ronda cambió",
  test: "Tu dispositivo recibe avisos de K66 Rondas",
};

export const occurrenceLabels: Record<string, string> = {
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
  incomplete: "Incompleta",
  missed: "No iniciada",
  cancelled: "Cancelada",
  unassigned: "Sin asignar",
};

export const assignmentIssues: Record<string, string> = {
  overlap: "El guardia tiene otra ronda en esta ventana.",
  assignee_unavailable: "La asignación o la plantilla ya no está disponible.",
  local_time_unavailable:
    "Esta hora local no existe por el cambio de horario. Ajusta la regla.",
};

export function formatPatrolDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
