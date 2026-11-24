import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

const rule = z
  .object({
    gate_id: z.uuid(),
    template_id: z.uuid(),
    guard_id: z.uuid(),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .transform((days) => [...new Set(days)]),
    local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    starts_on: z.iso.date(),
    ends_on: z.iso.date().nullable(),
    advance_minutes: z.number().int().min(1).max(120),
    start_grace_minutes: z.number().int().min(1).max(120),
    finish_minutes: z.number().int().min(1).max(240),
    notify_at_start: z.boolean(),
  })
  .refine(
    (value) =>
      (!value.ends_on || value.ends_on >= value.starts_on) &&
      value.finish_minutes >= value.start_grace_minutes,
  );

const operation = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    id: z.uuid().nullable(),
    active: z.boolean(),
    rule,
  }),
  z.object({ action: z.literal("toggle"), id: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("reassign"), id: z.uuid(), guard: z.uuid() }),
  z.object({ action: z.literal("cancel"), id: z.uuid() }),
]);

const errors: Record<string, string> = {
  ASSIGNMENT_INVALID:
    "El guardia o el recorrido no está disponible para esa garita.",
  ASSIGNMENT_OVERLAP: "Ese guardia tiene otra ronda dentro de la ventana.",
  OCCURRENCE_UNAVAILABLE:
    "La ronda ya cambió o su ventana terminó. Actualiza la agenda.",
  SCHEDULE_NOT_FOUND: "La regla ya no está disponible.",
};

export async function POST(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const input = operation.safeParse(await readJson(request));
  if (!input.success)
    return apiError(
      "INVALID_SCHEDULE",
      400,
      "Revisa días, horario, vigencia y márgenes. El plazo de cierre debe cubrir el margen de inicio.",
    );
  const action = input.data;
  const db = createAdminSupabaseUntyped();
  const result =
    action.action === "save" || action.action === "toggle"
      ? await db.rpc("save_patrol_schedule", {
          p_actor: actor.id,
          p_id: action.id,
          p_values: action.action === "save" ? action.rule : null,
          p_active: action.active,
        })
      : await db.rpc("change_patrol_occurrence", {
          p_actor: actor.id,
          p_id: action.id,
          p_guard: action.action === "reassign" ? action.guard : null,
          p_cancel: action.action === "cancel",
        });
  if (result.error) {
    const code = Object.keys(errors).find((key) =>
      result.error.message.includes(key),
    );
    return code
      ? apiError(code, 409, errors[code])
      : apiError(
          "SCHEDULE_FAILED",
          500,
          "No pudimos guardar la programación. Intenta de nuevo.",
        );
  }
  return Response.json({ ok: true });
}
