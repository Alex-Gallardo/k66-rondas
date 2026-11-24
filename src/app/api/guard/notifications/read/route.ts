import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const input = z.object({ id: z.uuid() }).safeParse(await readJson(request));
  if (!input.success)
    return apiError("INVALID_NOTICE", 400, "El aviso no está disponible.");
  const result = await createAdminSupabaseUntyped()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", input.data.id)
    .eq("guard_id", actor.id)
    .is("read_at", null);
  if (result.error)
    return apiError("NOTICE_READ_FAILED", 500, "No pudimos marcar el aviso.");
  return Response.json({ ok: true });
}
