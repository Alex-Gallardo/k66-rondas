import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { isCatalogResource, schemas } from "@/lib/admin/catalog-schema";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

type Context = { params: Promise<{ resource: string }> };

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("es-GT", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const { resource } = await context.params;
  if (!isCatalogResource(resource))
    return apiError("INVALID_RESOURCE", 404, "Catálogo desconocido.");

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(
    1,
    Math.min(10000, Number(url.searchParams.get("page")) || 1),
  );
  const active = url.searchParams.get("active") ?? "true";
  const db = createAdminSupabaseUntyped();
  let query = db
    .from(resource)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (active === "true" || active === "false")
    query = query.eq("active", active === "true");
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);
  if (
    (resource === "gates" || resource === "areas") &&
    url.searchParams.get("site_id")
  ) {
    query = query.eq("site_id", url.searchParams.get("site_id")!);
  }
  if (resource === "checkpoints" && url.searchParams.get("area_id")) {
    query = query.eq("area_id", url.searchParams.get("area_id")!);
  }
  const { data, count, error } = await query;
  if (error)
    return apiError("SERVER_ERROR", 500, "No pudimos cargar los registros.");
  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize: 20,
  });
}

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { resource } = await context.params;
  if (!isCatalogResource(resource))
    return apiError("INVALID_RESOURCE", 404, "Catálogo desconocido.");
  const parsed = schemas[resource].safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      parsed.error.issues[0]?.message ?? "Revisa los datos.",
    );

  const db = createAdminSupabaseUntyped();
  const body = parsed.data as Record<string, unknown>;
  if (
    resource === "sites" &&
    typeof body.timezone === "string" &&
    !isValidTimezone(body.timezone)
  ) {
    return apiError(
      "INVALID_TIMEZONE",
      400,
      "Selecciona una zona horaria válida.",
    );
  }
  if (resource === "gates" || resource === "areas") {
    const { data: site } = await db
      .from("sites")
      .select("id")
      .eq("id", body.site_id as string)
      .eq("active", true)
      .maybeSingle();
    if (!site) return apiError("INVALID_SITE", 400, "La sede no está activa.");
  }
  if (resource === "areas" && body.parent_id) {
    const { data: parent } = await db
      .from("areas")
      .select("id")
      .eq("id", body.parent_id as string)
      .eq("site_id", body.site_id as string)
      .eq("active", true)
      .maybeSingle();
    if (!parent)
      return apiError(
        "INVALID_PARENT",
        400,
        "El área padre no pertenece a la sede.",
      );
  }

  if (resource === "checkpoints") {
    const { data, error } = await db.rpc("create_checkpoint_with_qr", {
      p_area_id: body.area_id,
      p_code: body.code,
      p_name: body.name,
      p_description: body.description,
      p_public_code: randomBytes(16).toString("hex"),
      p_actor_id: actor.id,
    });
    if (error)
      return apiError(
        "SAVE_FAILED",
        400,
        "No pudimos crear el punto. Revisa el área y el código.",
      );
    return NextResponse.json({ id: data }, { status: 201 });
  }

  const { data, error } = await db
    .from(resource as string)
    .insert(body as never)
    .select("id")
    .single();
  if (error)
    return apiError(
      "SAVE_FAILED",
      400,
      "No pudimos guardar. Revisa que el código no exista.",
    );
  await db.from("audit_events").insert({
    actor_id: actor.id,
    action: `${resource}.created`,
    entity_type: resource,
    entity_id: data.id,
  });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
