import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import {
  createAdminSupabase,
  createAdminSupabaseUntyped,
} from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };
const reasonSchema = z.object({ reason: z.string().trim().min(4).max(300) });

function scanUrl(code: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("Falta APP_BASE_URL para generar etiquetas QR");
  return new URL(`/scan/${code}`, base).toString();
}

function safeFileName(code: string) {
  return code.replace(/[^A-Z0-9_-]/gi, "-");
}

export async function GET(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Punto no encontrado.");
  const db = createAdminSupabase();
  const { data: point } = await db
    .from("checkpoints")
    .select("id,code,name,active,area_id")
    .eq("id", id)
    .maybeSingle();
  if (!point?.active) return apiError("NOT_FOUND", 404, "Punto no encontrado.");
  const { data: area } = await db
    .from("areas")
    .select("name")
    .eq("id", point.area_id)
    .maybeSingle();
  const { data: qr } = await db
    .from("qr_codes")
    .select("public_code,version,created_at")
    .eq("checkpoint_id", id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!qr)
    return apiError("QR_NOT_FOUND", 404, "Este punto no tiene QR activo.");
  const url = scanUrl(qr.public_code);
  const format = new URL(request.url).searchParams.get("format");
  if (format === "svg") {
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${safeFileName(point.code)}-v${qr.version}.svg"`,
            }
          : {}),
      },
    });
  }
  if (format === "pdf") {
    const png = await QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([360, 510]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const qrImage = await pdf.embedPng(png);
    const printable = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/[^\x20-\x7E]/g, "")
        .slice(0, 44);
    page.drawText("K66 RONDAS", {
      x: 32,
      y: 462,
      size: 19,
      font: bold,
      color: rgb(0.04, 0.49, 0.4),
    });
    page.drawText(printable(point.name).slice(0, 30), {
      x: 32,
      y: 426,
      size: 16,
      font: bold,
    });
    page.drawText(printable(area?.name ?? "Area").slice(0, 43), {
      x: 32,
      y: 404,
      size: 11,
      font,
    });
    page.drawImage(qrImage, { x: 70, y: 129, width: 220, height: 220 });
    page.drawText(point.code, { x: 32, y: 95, size: 14, font: bold });
    page.drawText(`Version ${qr.version}  |  Escanea con K66 Rondas`, {
      x: 32,
      y: 69,
      size: 10,
      font,
    });
    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${safeFileName(point.code)}-v${qr.version}.pdf"`,
      },
    });
  }
  return NextResponse.json(
    {
      id,
      code: point.code,
      name: point.name,
      area: area?.name,
      url,
      version: qr.version,
      created_at: qr.created_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, context: Context) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return apiError("NOT_FOUND", 404, "Punto no encontrado.");
  const parsed = reasonSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "Escribe el motivo de la rotación.",
    );
  const db = createAdminSupabaseUntyped();
  const { data: version, error } = await db.rpc("rotate_checkpoint_qr", {
    p_checkpoint_id: id,
    p_public_code: randomBytes(16).toString("hex"),
    p_actor_id: actor.id,
    p_reason: parsed.data.reason,
  });
  if (error)
    return apiError(
      "ROTATION_FAILED",
      400,
      "No pudimos rotar el QR. Revisa que el punto siga activo.",
    );
  return NextResponse.json({ id, version });
}
