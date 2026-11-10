import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Visita no encontrada.");
  const parsed = z
    .object({ note: z.string().trim().min(1).max(1000) })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "Escribe una observación de hasta 1000 caracteres.",
    );
  const { data, error } = await createAdminSupabaseUntyped().rpc(
    "set_visit_note",
    {
      p_actor_id: actor.id,
      p_visit_id: id,
      p_note: parsed.data.note,
    },
  );
  if (error) {
    if (error.message.includes("NOTE_WINDOW_EXPIRED"))
      return apiError(
        "NOTE_WINDOW_EXPIRED",
        409,
        "La observación solo puede añadirse durante 15 minutos.",
      );
    if (error.message.includes("VISIT_NOT_FOUND"))
      return apiError("NOT_FOUND", 404, "Visita no encontrada.");
    return apiError("SAVE_FAILED", 400, "No pudimos guardar la observación.");
  }
  return NextResponse.json({ id, note_updated_at: data });
}
