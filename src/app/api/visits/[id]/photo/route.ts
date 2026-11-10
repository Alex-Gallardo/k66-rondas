import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
} from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };
const bucket = "visit-photos";
const allowed = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function validImage(bytes: Buffer, mime: string) {
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request, "multipart/form-data");
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Visita no encontrada.");
  const db = createAdminSupabase();
  const { data: visit } = await db
    .from("visits")
    .select("id,guard_id,gate_id,recorded_at")
    .eq("id", id)
    .eq("guard_id", actor.id)
    .maybeSingle();
  if (!visit) return apiError("NOT_FOUND", 404, "Visita no encontrada.");
  if (Date.now() - new Date(visit.recorded_at).getTime() > 15 * 60_000)
    return apiError(
      "PHOTO_WINDOW_EXPIRED",
      409,
      "Añade la foto durante los primeros 15 minutos.",
    );
  const { data: existing } = await db
    .from("visit_photos")
    .select("id")
    .eq("visit_id", id)
    .maybeSingle();
  if (existing)
    return apiError("PHOTO_EXISTS", 409, "Esta visita ya tiene una foto.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", 400, "Selecciona una fotografía.");
  }
  const file = form.get("photo");
  if (
    !(file instanceof File) ||
    !allowed.has(file.type) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    return apiError(
      "INVALID_PHOTO",
      400,
      "Usa una foto JPG, PNG o WebP de hasta 5 MB.",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!validImage(bytes, file.type))
    return apiError(
      "INVALID_PHOTO",
      400,
      "La fotografía no tiene un formato válido.",
    );
  const { data: gate } = await db
    .from("gates")
    .select("site_id")
    .eq("id", visit.gate_id)
    .single();
  if (!gate)
    return apiError("SERVER_ERROR", 500, "No pudimos identificar la sede.");
  const path = `${gate.site_id}/${id}/${randomUUID()}.${allowed.get(file.type)}`;
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError)
    return apiError(
      "UPLOAD_FAILED",
      500,
      "La visita se guardó, pero la foto no pudo subirse.",
    );
  const { error: saveError } = await db.from("visit_photos").insert({
    visit_id: id,
    storage_path: path,
    mime_type: file.type,
    bytes: file.size,
    uploaded_by: actor.id,
  });
  if (saveError) {
    await db.storage.from(bucket).remove([path]);
    return apiError(
      "PHOTO_EXISTS",
      409,
      "No pudimos asociar la fotografía. La visita sigue guardada.",
    );
  }
  return NextResponse.json({ visit_id: id, uploaded: true }, { status: 201 });
}

export async function GET(_request: Request, context: Context) {
  const actor = await apiActor(["guard", "admin"]);
  if (isApiError(actor)) return actor;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Foto no encontrada.");
  const db = createAdminSupabase();
  const { data: visit } = await db
    .from("visits")
    .select("guard_id")
    .eq("id", id)
    .maybeSingle();
  if (!visit || (actor.role === "guard" && visit.guard_id !== actor.id))
    return apiError("NOT_FOUND", 404, "Foto no encontrada.");
  const { data: photo } = await db
    .from("visit_photos")
    .select("storage_path")
    .eq("visit_id", id)
    .maybeSingle();
  if (!photo) return apiError("NOT_FOUND", 404, "Foto no encontrada.");
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(photo.storage_path, 60);
  if (error || !data?.signedUrl)
    return apiError("SERVER_ERROR", 500, "No pudimos abrir la foto.");
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "no-store" },
  });
}
