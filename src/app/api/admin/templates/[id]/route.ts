import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Plantilla no encontrada.");
  const parsed = z
    .object({ operation: z.enum(["archive", "restore"]) })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", 400, "Acción no válida.");
  const db = createAdminSupabase();
  const { data: existing } = await db
    .from("patrol_templates")
    .select("id,active")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return apiError("NOT_FOUND", 404, "Plantilla no encontrada.");
  const active = parsed.data.operation === "restore";
  if (existing.active === active)
    return apiError("INVALID_ACTION", 400, "La plantilla ya tiene ese estado.");
  const { error } = await db
    .from("patrol_templates")
    .update({ active, is_default: false })
    .eq("id", id);
  if (error)
    return apiError("SAVE_FAILED", 400, "No pudimos actualizar la plantilla.");
  await db.from("audit_events").insert({
    actor_id: actor.id,
    action: `template.${parsed.data.operation}`,
    entity_type: "patrol_template",
    entity_id: id,
  });
  return NextResponse.json({ id, active });
}
