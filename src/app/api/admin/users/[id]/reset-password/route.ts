import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
} from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Usuario no encontrado.");
  const db = createAdminSupabase();
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return apiError("NOT_FOUND", 404, "Usuario no encontrado.");
  const temporaryPassword = randomBytes(18).toString("base64url");
  const { error: authError } = await db.auth.admin.updateUserById(id, {
    password: temporaryPassword,
  });
  if (authError)
    return apiError(
      "RESET_FAILED",
      500,
      "No pudimos restablecer la contraseña.",
    );
  const { error: profileError } = await db
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  if (profileError)
    return apiError(
      "RESET_FAILED",
      500,
      "La contraseña cambió, pero falta completar el perfil. Reintenta el restablecimiento.",
    );
  await db.from("audit_events").insert({
    actor_id: actor.id,
    action: "user.password_reset",
    entity_type: "profile",
    entity_id: id,
  });
  return NextResponse.json({ temporary_password: temporaryPassword });
}
