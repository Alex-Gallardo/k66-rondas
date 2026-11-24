import { NextResponse } from "next/server";
import { apiError, checkMutationRequest } from "@/lib/api";
import { setPushDeviceSession } from "@/lib/notifications/device";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  try {
    await setPushDeviceSession(null);
  } catch {
    return apiError(
      "DEVICE_RELEASE_FAILED",
      503,
      "No pudimos desvincular los avisos. Reintenta antes del relevo.",
    );
  }
  const session = await createServerSupabase();
  const { error } = await session.auth.signOut({ scope: "local" });
  if (error && error.name !== "AuthSessionMissingError")
    return apiError(
      "LOGOUT_FAILED",
      503,
      "No pudimos cerrar la sesión. Intenta de nuevo.",
    );
  return NextResponse.json({ destination: "/login" });
}
