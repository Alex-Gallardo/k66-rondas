import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
} from "@/lib/api";
import { guardRpcError } from "@/lib/guard/rpc-error";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Turno no encontrado.");
  const { data, error } = await createAdminSupabase().rpc(
    "close_guard_shift",
    {
      p_actor_id: actor.id,
      p_shift_id: id,
    },
  );
  if (error) return guardRpcError(error.message);
  return NextResponse.json({ id, ended_at: data });
}
