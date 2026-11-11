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

const schema = z.strictObject({ site_id: z.uuid(), geo_enabled: z.boolean() });

export async function PATCH(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "Revisa la sede y la política GPS.",
    );
  const { data, error } = await createAdminSupabase().rpc(
    "update_site_geo_policy",
    {
      p_actor_id: actor.id,
      p_site_id: parsed.data.site_id,
      p_geo_enabled: parsed.data.geo_enabled,
    },
  );
  if (error) {
    if (error.message.includes("SITE_NOT_FOUND"))
      return apiError("SITE_NOT_FOUND", 404, "La sede no está activa.");
    return apiError("SAVE_FAILED", 500, "No pudimos guardar la política.");
  }
  return NextResponse.json(
    { geo_enabled: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
