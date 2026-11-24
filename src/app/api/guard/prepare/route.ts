import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { getGuardCurrent } from "@/lib/guard/current";
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
  const input = z
    .object({ occurrence_id: z.uuid().optional() })
    .safeParse(await readJson(request));
  if (!input.success)
    return apiError(
      "INVALID_OCCURRENCE",
      400,
      "La ronda indicada no está disponible.",
    );
  const occurrence = input.data.occurrence_id;
  const scheduleDb = createAdminSupabaseUntyped();
  if (occurrence) {
    const result = await scheduleDb.rpc("start_scheduled_patrol", {
      p_actor: actor.id,
      p_occurrence: occurrence,
    });
    if (result.error) return guardRpcError(result.error.message);
    const current = await getGuardCurrent(actor);
    if (!current.shift || !current.patrol || current.patrol.id !== result.data)
      return apiError(
        "OCCURRENCE_UNAVAILABLE",
        409,
        "Esta ronda ya no está disponible.",
      );
    return NextResponse.json({
      shift_id: current.shift.id,
      patrol_id: current.patrol.id,
      scheduled_patrol_id: current.patrol.id,
      timezone: current.timezone,
    });
  }

  let current = await getGuardCurrent(actor);
  if (!current.patrol) {
    const now = new Date().toISOString();
    const eligible = await scheduleDb
      .from("patrol_occurrences")
      .select("id")
      .eq("guard_id", actor.id)
      .eq("status", "scheduled")
      .lte("remind_at", now)
      .gt("start_until", now)
      .limit(1);
    if (eligible.error)
      return apiError(
        "SCHEDULE_UNAVAILABLE",
        503,
        "No pudimos verificar tu agenda. Intenta de nuevo.",
      );
    if (eligible.data.length)
      return apiError(
        "SELECT_OCCURRENCE",
        409,
        "Tienes una ronda programada. Elige la ronda antes de escanear.",
      );
  }
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
  const linked = await scheduleDb
    .from("patrol_occurrences")
    .select("id")
    .eq("patrol_id", current.patrol.id)
    .eq("guard_id", actor.id)
    .maybeSingle();
  if (linked.error)
    return apiError(
      "SCHEDULE_UNAVAILABLE",
      503,
      "No pudimos verificar tu agenda. Intenta de nuevo.",
    );
  return NextResponse.json({
    shift_id: current.shift.id,
    patrol_id: current.patrol.id,
    scheduled_patrol_id: linked.data ? current.patrol.id : null,
    timezone: current.timezone,
  });
}
