import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { isCatalogResource, schemas } from "@/lib/admin/catalog-schema";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

type Context = { params: Promise<{ resource: string; id: string }> };

async function validateAreaParent(
  db: ReturnType<typeof createAdminSupabaseUntyped>,
  areaId: string,
  parentId: string | null,
  siteId: string,
) {
  const visited = new Set([areaId]);
  let cursor = parentId;
  while (cursor) {
    if (visited.has(cursor)) return false;
    visited.add(cursor);
    const { data } = await db
      .from("areas")
      .select("parent_id,site_id,active")
      .eq("id", cursor)
      .maybeSingle();
    if (!data?.active || data.site_id !== siteId) return false;
    cursor = data.parent_id;
    if (visited.size > 100) return false;
  }
  return true;
}

export async function PATCH(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { resource, id } = await context.params;
  if (!isCatalogResource(resource) || !z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Registro no encontrado.");
  const payload = await readJson(request);
  const operation = z
    .object({
      operation: z.enum(["update", "archive", "restore", "verify"]),
      data: z.unknown().optional(),
    })
    .safeParse(payload);
  if (!operation.success)
    return apiError("VALIDATION_ERROR", 400, "Acción no válida.");

  const db = createAdminSupabaseUntyped();
  const { data: existing } = await db
    .from(resource)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return apiError("NOT_FOUND", 404, "Registro no encontrado.");
  const action = operation.data.operation;
  let changes: Record<string, unknown>;

  if (action === "verify") {
    if (resource !== "checkpoints" || !existing.active)
      return apiError(
        "INVALID_ACTION",
        400,
        "Este punto no se puede verificar.",
      );
    changes = { last_verified_at: new Date().toISOString() };
  } else if (action === "archive" || action === "restore") {
    if (action === "archive" && !existing.active)
      return apiError("INVALID_ACTION", 400, "Ya está archivado.");
    if (action === "restore" && existing.active)
      return apiError("INVALID_ACTION", 400, "Ya está activo.");
    if (action === "archive") {
      const child =
        resource === "sites"
          ? ["gates", "areas"]
          : resource === "areas"
            ? ["areas", "checkpoints"]
            : resource === "gates"
              ? ["patrol_templates"]
              : [];
      for (const table of child) {
        const foreignKey =
          table === "gates" || (table === "areas" && resource === "sites")
            ? "site_id"
            : table === "areas"
              ? "parent_id"
              : table === "checkpoints"
                ? "area_id"
                : "gate_id";
        const { count } = await db
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq(foreignKey, id)
          .eq("active", true);
        if (count)
          return apiError(
            "HAS_ACTIVE_CHILDREN",
            409,
            "Archiva primero los elementos activos relacionados.",
          );
      }
      if (resource === "checkpoints") {
        const { count } = await db
          .from("template_points")
          .select("id", { count: "exact", head: true })
          .eq("checkpoint_id", id);
        if (count)
          return apiError(
            "IN_TEMPLATE",
            409,
            "Quita el punto de las plantillas antes de archivarlo.",
          );
      }
    }
    if (action === "restore" && resource === "gates") {
      const { data: site } = await db
        .from("sites")
        .select("active")
        .eq("id", existing.site_id)
        .single();
      if (!site?.active)
        return apiError("INVALID_SITE", 409, "Activa primero la sede.");
    }
    if (action === "restore" && resource === "areas") {
      if (
        !(await validateAreaParent(
          db,
          id,
          existing.parent_id,
          existing.site_id,
        ))
      )
        return apiError("INVALID_PARENT", 409, "Activa primero el área padre.");
    }
    if (action === "restore" && resource === "checkpoints") {
      const { data: area } = await db
        .from("areas")
        .select("active")
        .eq("id", existing.area_id)
        .single();
      if (!area?.active)
        return apiError("INVALID_AREA", 409, "Activa primero el área.");
    }
    changes = { active: action === "restore" };
  } else {
    const parsed = schemas[resource].safeParse(operation.data.data);
    if (!parsed.success)
      return apiError(
        "VALIDATION_ERROR",
        400,
        parsed.error.issues[0]?.message ?? "Revisa los datos.",
      );
    const input = parsed.data as Record<string, unknown>;
    if (input.code !== existing.code)
      return apiError(
        "CODE_IMMUTABLE",
        400,
        "El código no se puede cambiar después de crear el registro.",
      );
    if (resource === "sites" && typeof input.timezone === "string") {
      try {
        new Intl.DateTimeFormat("es-GT", { timeZone: input.timezone });
      } catch {
        return apiError("INVALID_TIMEZONE", 400, "Zona horaria no válida.");
      }
    }
    if (resource === "gates" && input.site_id !== existing.site_id)
      return apiError(
        "SITE_IMMUTABLE",
        400,
        "La sede de la garita no se puede cambiar.",
      );
    if (resource === "areas") {
      if (input.site_id !== existing.site_id)
        return apiError(
          "SITE_IMMUTABLE",
          400,
          "La sede del área no se puede cambiar.",
        );
      if (
        !(await validateAreaParent(
          db,
          id,
          input.parent_id as string | null,
          existing.site_id,
        ))
      )
        return apiError(
          "INVALID_PARENT",
          400,
          "El área padre debe estar activa y no formar un ciclo.",
        );
    }
    if (resource === "checkpoints" && input.area_id !== existing.area_id)
      return apiError(
        "AREA_IMMUTABLE",
        400,
        "Archiva el punto y crea uno nuevo para cambiar de área.",
      );
    changes = { ...input };
    delete changes.code;
    if (resource === "gates" || resource === "areas") delete changes.site_id;
    if (resource === "checkpoints") delete changes.area_id;
  }

  const { error } = await db.from(resource).update(changes).eq("id", id);
  if (error)
    return apiError("SAVE_FAILED", 400, "No pudimos guardar los cambios.");
  await db.from("audit_events").insert({
    actor_id: actor.id,
    action: `${resource}.${action}`,
    entity_type: resource,
    entity_id: id,
  });
  return NextResponse.json({ id, active: changes.active ?? existing.active });
}
