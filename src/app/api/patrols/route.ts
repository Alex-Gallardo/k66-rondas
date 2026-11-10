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
import {
  createAdminSupabase,
  createAdminSupabaseUntyped,
} from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = z
    .object({ template_id: z.uuid().optional() })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", 400, "Elige una plantilla válida.");
  const db = createAdminSupabase();
  const { data: shift, error: shiftError } = await db
    .from("shifts")
    .select("id,gate_id")
    .eq("guard_id", actor.id)
    .is("ended_at", null)
    .maybeSingle();
  if (shiftError)
    return apiError("SERVER_ERROR", 500, "No pudimos consultar tu turno.");
  if (!shift)
    return apiError("NO_ACTIVE_SHIFT", 409, "Inicia un turno primero.");
  let templateId = parsed.data.template_id;
  if (!templateId) {
    const { data: templates, error: templateError } = await db
      .from("patrol_templates")
      .select("id,is_default")
      .eq("gate_id", shift.gate_id)
      .eq("active", true);
    if (templateError)
      return apiError(
        "SERVER_ERROR",
        500,
        "No pudimos consultar las plantillas.",
      );
    templateId =
      templates?.find((item) => item.is_default)?.id ??
      (templates?.length === 1 ? templates[0].id : undefined);
    if (!templateId)
      return apiError(
        "TEMPLATE_REQUIRED",
        409,
        "Elige una plantilla para esta garita.",
      );
  }
  const { data, error } = await createAdminSupabaseUntyped().rpc(
    "start_patrol_with_snapshot",
    {
      p_actor_id: actor.id,
      p_shift_id: shift.id,
      p_template_id: templateId,
    },
  );
  if (error) return guardRpcError(error.message);
  return NextResponse.json({ id: data }, { status: 201 });
}
