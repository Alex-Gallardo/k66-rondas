import { NextResponse } from "next/server";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
} from "@/lib/api";
import { getGuardCurrent } from "@/lib/guard/current";
import { guardGeoEnabled } from "@/lib/guard/geo-policy";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;

  let current = await getGuardCurrent(actor);
  if (!current.shift) {
    if (current.gates.length !== 1)
      return apiError(
        "SELECT_GATE",
        409,
        "Selecciona una garita en el inicio.",
      );
    const { error } = await createAdminSupabase().rpc("open_guard_shift", {
      p_actor_id: actor.id,
      p_gate_id: current.gates[0].id,
    });
    if (error && !error.message.includes("SHIFT_ALREADY_OPEN"))
      return apiError("SHIFT_FAILED", 409, "No pudimos iniciar el turno.");
    current = await getGuardCurrent(actor);
  }
  if (!current.shift)
    return apiError("SHIFT_FAILED", 409, "No hay un turno activo.");

  if (!current.patrol) {
    const template =
      current.templates.find((item) => item.is_default) ??
      (current.templates.length === 1 ? current.templates[0] : null);
    if (!template)
      return apiError(
        "SELECT_TEMPLATE",
        409,
        "Selecciona una plantilla en el inicio.",
      );
    const { error } = await createAdminSupabase().rpc(
      "start_patrol_with_snapshot",
      {
        p_actor_id: actor.id,
        p_shift_id: current.shift.id,
        p_template_id: template.id,
      },
    );
    if (error && error.code !== "23505")
      return apiError("PATROL_FAILED", 409, "No pudimos iniciar la ronda.");
    current = await getGuardCurrent(actor);
  }
  if (!current.patrol)
    return apiError("PATROL_FAILED", 409, "No hay una ronda activa.");
  return NextResponse.json({
    shift_id: current.shift.id,
    patrol_id: current.patrol.id,
    timezone: current.timezone,
    geo_enabled: await guardGeoEnabled(actor.id),
  });
}
