import { apiError } from "@/lib/api";

const messages: Record<string, [string, number, string]> = {
  FORBIDDEN: ["FORBIDDEN", 403, "Tu cuenta no puede realizar esta acción."],
  GATE_NOT_ASSIGNED: [
    "GATE_NOT_ASSIGNED",
    403,
    "Esta garita ya no está asignada a tu cuenta.",
  ],
  SHIFT_ALREADY_OPEN: [
    "SHIFT_ALREADY_OPEN",
    409,
    "Ya tienes un turno abierto.",
  ],
  SHIFT_NOT_OPEN: ["SHIFT_NOT_OPEN", 409, "Este turno ya no está abierto."],
  SHIFT_NOT_FOUND: [
    "SHIFT_NOT_FOUND",
    409,
    "Inicia un turno antes de comenzar la ronda.",
  ],
  PATROL_STILL_OPEN: [
    "PATROL_STILL_OPEN",
    409,
    "Cierra la ronda antes de terminar el turno.",
  ],
  PATROL_NOT_OPEN: ["PATROL_NOT_OPEN", 409, "Esta ronda ya no está abierta."],
  TEMPLATE_NOT_FOUND: [
    "TEMPLATE_NOT_FOUND",
    409,
    "La plantilla ya no está disponible.",
  ],
  EMPTY_TEMPLATE: ["EMPTY_TEMPLATE", 409, "La plantilla no tiene puntos."],
  INACTIVE_TEMPLATE_POINT: [
    "INACTIVE_TEMPLATE_POINT",
    409,
    "La plantilla contiene un punto archivado.",
  ],
  CLOSURE_REASON_REQUIRED: [
    "CLOSURE_REASON_REQUIRED",
    400,
    "Indica por qué quedaron puntos obligatorios pendientes.",
  ],
  CLOSURE_REASON_TOO_LONG: [
    "CLOSURE_REASON_TOO_LONG",
    400,
    "El motivo puede tener hasta 500 caracteres.",
  ],
};

export function guardRpcError(message: string) {
  const match = Object.entries(messages).find(([key]) => message.includes(key));
  const [code, status, description] = match?.[1] ?? [
    "OPERATION_FAILED",
    400,
    "No pudimos completar la acción. Actualiza la pantalla e intenta de nuevo.",
  ];
  return apiError(code, status, description);
}
