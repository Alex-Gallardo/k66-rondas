import { NextResponse } from "next/server";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { templateInput } from "@/lib/admin/template-schema";
import {
  createAdminSupabase,
  createAdminSupabaseUntyped,
} from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const url = new URL(request.url);
  const page = Math.max(
    1,
    Math.min(10000, Number(url.searchParams.get("page")) || 1),
  );
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const db = createAdminSupabase();
  let query = db
    .from("patrol_templates")
    .select("id,gate_id,name,is_default,active,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);
  const { data, count, error } = await query;
  if (error)
    return apiError("SERVER_ERROR", 500, "No pudimos cargar las plantillas.");
  const ids = (data ?? []).map((item) => item.id);
  const gateIds = [...new Set((data ?? []).map((item) => item.gate_id))];
  const [pointsResult, gatesResult] = await Promise.all([
    ids.length
      ? db
          .from("template_points")
          .select("template_id,checkpoint_id,position,required")
          .in("template_id", ids)
          .order("position")
      : Promise.resolve({ data: [] }),
    gateIds.length
      ? db.from("gates").select("id,name,code").in("id", gateIds)
      : Promise.resolve({ data: [] }),
  ]);
  const items = (data ?? []).map((item) => ({
    ...item,
    gate: gatesResult.data?.find((gate) => gate.id === item.gate_id) ?? null,
    points:
      pointsResult.data?.filter((point) => point.template_id === item.id) ?? [],
  }));
  return NextResponse.json({ items, total: count ?? 0, page, pageSize: 20 });
}

export async function POST(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = templateInput.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      parsed.error.issues[0]?.message ?? "Revisa la plantilla.",
    );
  const input = parsed.data;
  const db = createAdminSupabaseUntyped();
  const { data, error } = await db.rpc("save_patrol_template", {
    p_template_id: input.id,
    p_gate_id: input.gate_id,
    p_name: input.name,
    p_is_default: input.is_default,
    p_points: input.points,
    p_actor_id: actor.id,
  });
  if (error)
    return apiError(
      "SAVE_FAILED",
      400,
      "No pudimos guardar la plantilla. Comprueba que los puntos estén activos y sean de la misma sede que la garita.",
    );
  return NextResponse.json({ id: data }, { status: input.id ? 200 : 201 });
}
