import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkMutationRequest, readJson } from "@/lib/api";
import { getActor } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({ password: z.string().min(10).max(128) });

export async function POST(request: Request) {
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const actor = await getActor();
  if (!actor)
    return apiError("NOT_AUTHENTICATED", 401, "Inicia sesión para continuar.");
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", 400, "Usa al menos 10 caracteres.");

  const session = await createServerSupabase();
  const { error } = await session.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return apiError(
      "PASSWORD_UPDATE_FAILED",
      400,
      "No pudimos cambiar la contraseña.",
    );

  const db = createAdminSupabase();
  const { error: profileError } = await db
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", actor.id);
  if (profileError)
    return apiError(
      "SERVER_ERROR",
      500,
      "No pudimos completar el cambio. Intenta de nuevo.",
    );

  return NextResponse.json({
    destination: actor.role === "guard" ? "/app" : "/admin",
  });
}
