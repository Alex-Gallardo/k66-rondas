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
import { isValidQrCode } from "@/lib/guard/qr";
import { clientIpFromRequest } from "@/lib/guard/client-ip";

const capturedGeo = z.strictObject({
  status: z.literal("captured"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100000).optional(),
  captured_at: z.iso.datetime({ offset: true }).optional(),
});
const missingGeo = z.strictObject({
  status: z.enum(["denied", "timeout", "unavailable", "disabled"]),
});
const visitSchema = z.strictObject({
  qr_code: z.string().refine(isValidQrCode),
  idempotency_key: z.uuid(),
  geo: z.union([capturedGeo, missingGeo]).optional(),
});
const visitResultSchema = z.object({
  outcome: z.enum(["recorded", "idempotent", "already_scanned"]),
  visit_id: z.uuid(),
  patrol_id: z.uuid(),
  recorded_at: z.string(),
  checkpoint_id: z.uuid(),
  checkpoint_name: z.string(),
  area_name: z.string(),
  patrol_status: z.enum(["in_progress", "completed", "incomplete"]),
  progress: z.object({
    visited: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    required_visited: z.number().int().nonnegative(),
    required_total: z.number().int().nonnegative(),
  }),
});

const failures: Record<string, [string, number, string]> = {
  INVALID_QR_OR_KEY: ["INVALID_QR", 400, "No reconocemos este punto QR."],
  INVALID_QR: ["INVALID_QR", 400, "No reconocemos este punto QR."],
  FORBIDDEN: ["FORBIDDEN", 403, "Tu cuenta no puede registrar visitas."],
  INVALID_GEO: ["INVALID_GEO", 400, "La ubicación recibida no es válida."],
  GEO_REQUIRED: [
    "GEO_REQUIRED",
    409,
    "Activa el GPS y permite la ubicación para guardar este punto.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "IDEMPOTENCY_CONFLICT",
    409,
    "Este intento ya se usó para otro código. Escanea de nuevo.",
  ],
  NO_ACTIVE_PATROL: [
    "NO_ACTIVE_PATROL",
    409,
    "Inicia una ronda antes de registrar un punto.",
  ],
  POINT_NOT_EXPECTED: [
    "POINT_NOT_EXPECTED",
    409,
    "Este punto no pertenece a la ronda actual.",
  ],
};

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  function respond(response: NextResponse, outcome: string) {
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    response.headers.set("Server-Timing", `visit;dur=${durationMs}`);
    response.headers.set("X-Request-Id", requestId);
    response.headers.set("Cache-Control", "no-store");
    console.info(
      JSON.stringify({
        event: "visit.save",
        request_id: requestId,
        status: response.status,
        outcome,
        duration_ms: durationMs,
      }),
    );
    return response;
  }
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return respond(actor, "access_denied");
  const invalid = checkMutationRequest(request);
  if (invalid) return respond(invalid, "invalid_request");
  const parsed = visitSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return respond(
      apiError(
        "VALIDATION_ERROR",
        400,
        "Revisa el QR y la ubicación recibida.",
      ),
      "validation_error",
    );

  if (parsed.data.geo?.status !== "captured")
    return respond(
      apiError(
        "GEO_REQUIRED",
        409,
        "Activa el GPS y permite la ubicación para guardar este punto.",
      ),
      "geo_required",
    );

  const db = createAdminSupabase();
  let qrCode = parsed.data.qr_code;
  if (qrCode.length === 16) {
    const { data: legacy, error: legacyError } = await db
      .from("qr_codes")
      .select("public_code")
      .eq("legacy_code", qrCode)
      .is("revoked_at", null)
      .maybeSingle();
    if (legacyError)
      return respond(
        apiError("SAVE_FAILED", 500, "No pudimos consultar el QR."),
        "qr_lookup_error",
      );
    if (!legacy)
      return respond(
        apiError("INVALID_QR", 400, "No reconocemos este punto QR."),
        "invalid_qr",
      );
    qrCode = legacy.public_code;
  }
  const { data, error } = await db.rpc("record_visit", {
    p_actor_id: actor.id,
    p_qr_code: qrCode,
    p_idempotency_key: parsed.data.idempotency_key,
    p_geo: {
      ...parsed.data.geo,
      client_ip: clientIpFromRequest(request),
    },
  });
  if (error) {
    const entry = Object.entries(failures).find(([code]) =>
      error.message.includes(code),
    )?.[1];
    if (entry) return respond(apiError(...entry), entry[0].toLowerCase());
    return respond(
      apiError(
        "SAVE_FAILED",
        500,
        "No pudimos guardar la visita. Intenta de nuevo.",
      ),
      "save_error",
    );
  }
  const result = visitResultSchema.safeParse(data);
  if (!result.success)
    return respond(
      apiError(
        "INVALID_RESPONSE",
        500,
        "No pudimos confirmar el registro. Reintenta con el mismo código.",
      ),
      "invalid_response",
    );
  return respond(
    NextResponse.json(result.data, {
      status: result.data.outcome === "recorded" ? 201 : 200,
    }),
    result.data.outcome,
  );
}
