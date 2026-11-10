import QRCode from "qrcode";
import { z } from "zod";
import { apiActor, apiError, isApiError } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  if (actor.employeeCode !== "DEMO-001")
    return apiError("FORBIDDEN", 403, "QR no disponible.");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "QR no encontrado.");
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("qr_codes")
    .select("public_code,checkpoints!inner(areas!inner(sites!inner(code)))")
    .eq("id", id)
    .eq("checkpoints.areas.sites.code", "K66-DEMO")
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return apiError("NOT_FOUND", 404, "QR no encontrado.");
  const target = new URL(`/scan/${data.public_code}`, request.url);
  const svg = await QRCode.toString(target.href, {
    type: "svg",
    margin: 2,
    width: 320,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
