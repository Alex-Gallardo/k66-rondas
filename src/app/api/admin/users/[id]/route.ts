import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { userUpdate } from "@/lib/admin/user-schema";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Usuario no encontrado.");
  const parsed = userUpdate.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      parsed.error.issues[0]?.message ?? "Revisa los datos.",
    );
  const input = parsed.data;
  const db = createAdminSupabaseUntyped();
  const { error } = await db.rpc("update_profile_with_gates", {
    p_user_id: id,
    p_full_name: input.full_name,
    p_role: input.role,
    p_active: input.active,
    p_gate_ids: input.gate_ids,
    p_actor_id: actor.id,
  });
  if (error)
    return apiError(
      "USER_UPDATE_FAILED",
      400,
      error.message.includes("LAST_ADMIN")
        ? "Debe quedar al menos un administrador activo."
        : error.message.includes("CANNOT_DEMOTE_SELF")
          ? "No puedes quitarte el acceso de administrador."
          : "No pudimos guardar. Revisa las garitas asignadas.",
    );
  return NextResponse.json({ id });
}
