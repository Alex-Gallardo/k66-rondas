import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { guardRpcError } from "@/lib/guard/rpc-error";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Ronda no encontrada.");
  const parsed = z
    .object({ reason: z.string().trim().max(500).optional() })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "El motivo puede tener hasta 500 caracteres.",
    );
  const { data, error } = await createAdminSupabaseUntyped().rpc(
    "close_guard_patrol",
    {
      p_actor_id: actor.id,
      p_patrol_id: id,
      p_reason: parsed.data.reason ?? null,
    },
  );
  if (error) return guardRpcError(error.message);
  return NextResponse.json({ id, status: data });
}
