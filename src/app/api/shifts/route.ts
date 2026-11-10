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

export async function POST(request: Request) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = z
    .object({ gate_id: z.uuid() })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", 400, "Elige una garita válida.");
  const { data, error } = await createAdminSupabaseUntyped().rpc(
    "open_guard_shift",
    {
      p_actor_id: actor.id,
      p_gate_id: parsed.data.gate_id,
    },
  );
  if (error) return guardRpcError(error.message);
  return NextResponse.json({ id: data }, { status: 201 });
}
