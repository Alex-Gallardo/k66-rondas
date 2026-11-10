import { NextResponse } from "next/server";
import { apiActor, apiError, isApiError } from "@/lib/api";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

const allowed = new Set(["sites", "gates", "areas", "checkpoints"]);

export async function GET(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;

  const url = new URL(request.url);
  const resource = url.searchParams.get("type") ?? "";
  if (!allowed.has(resource))
    return apiError("INVALID_RESOURCE", 400, "Catálogo desconocido.");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const siteId = url.searchParams.get("site_id");
  const id = url.searchParams.get("id");
  const db = createAdminSupabaseUntyped();
  if (resource === "gates" && id) {
    const { data, error } = await db
      .from("gates")
      .select("id,code,name,site_id")
      .eq("id", id)
      .eq("active", true)
      .limit(1);
    if (error)
      return apiError("SERVER_ERROR", 500, "No pudimos cargar la garita.");
    return NextResponse.json({ items: data ?? [] });
  }
  if (resource === "checkpoints" && siteId) {
    let points = db
      .from("checkpoints")
      .select("id,code,name,areas!inner(site_id)")
      .eq("active", true)
      .eq("areas.site_id", siteId)
      .order("name")
      .limit(50);
    if (id) points = points.eq("id", id);
    else if (q)
      points = points.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);
    const { data, error } = await points;
    if (error)
      return apiError("SERVER_ERROR", 500, "No pudimos cargar los puntos.");
    return NextResponse.json({ items: data ?? [] });
  }
  let query = db
    .from(resource as string)
    .select("id,code,name")
    .eq("active", true)
    .order("name")
    .limit(50);
  if (id) query = query.eq("id", id);
  else if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);
  if (siteId && (resource === "gates" || resource === "areas"))
    query = query.eq("site_id", siteId);
  const { data, error } = await query;
  if (error)
    return apiError("SERVER_ERROR", 500, "No pudimos cargar las opciones.");
  return NextResponse.json({ items: data ?? [] });
}
