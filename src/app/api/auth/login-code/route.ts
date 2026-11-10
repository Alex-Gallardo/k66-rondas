import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkMutationRequest, readJson } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const loginSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,32}$/),
  password: z.string().min(1).max(128),
});

const invalidLogin = () =>
  apiError("INVALID_CREDENTIALS", 401, "Código o contraseña incorrectos.");

export async function POST(request: Request) {
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidLogin();

  const db = createAdminSupabase();
  const { data: profile, error } = await db
    .from("profiles")
    .select("id,role,active,must_change_password")
    .eq("employee_code", parsed.data.code)
    .maybeSingle();
  if (error)
    return apiError(
      "SERVER_ERROR",
      500,
      "No pudimos iniciar sesión. Intenta de nuevo.",
    );
  if (!profile?.active) return invalidLogin();

  const { data: account, error: accountError } =
    await db.auth.admin.getUserById(profile.id);
  if (accountError || !account.user?.email) return invalidLogin();

  const session = await createServerSupabase();
  const { error: loginError } = await session.auth.signInWithPassword({
    email: account.user.email,
    password: parsed.data.password,
  });
  if (loginError) return invalidLogin();

  const destination = profile.must_change_password
    ? "/change-password"
    : profile.role === "guard"
      ? "/app"
      : "/admin";
  return NextResponse.json({ destination });
}
