import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

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
  qr_code: z.string().regex(/^[0-9a-f]{32}$/),
  idempotency_key: z.uuid(),
  geo: z.union([capturedGeo, missingGeo]).optional(),
});

const failures: Record<string, [string, number, string]> = {
  INVALID_QR_OR_KEY: ["INVALID_QR", 400, "No reconocemos este punto QR."],
  INVALID_QR: ["INVALID_QR", 400, "No reconocemos este punto QR."],
  FORBIDDEN: ["FORBIDDEN", 403, "Tu cuenta no puede registrar visitas."],
  INVALID_GEO: ["INVALID_GEO", 400, "La ubicación recibida no es válida."],
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
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = visitSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "Revisa el QR y la ubicación recibida.",
    );

  const { data, error } = await createAdminSupabaseUntyped().rpc(
    "record_visit",
    {
      p_actor_id: actor.id,
      p_qr_code: parsed.data.qr_code,
      p_idempotency_key: parsed.data.idempotency_key,
      p_geo: parsed.data.geo ?? { status: "unavailable" },
    },
  );
  if (error) {
    const entry = Object.entries(failures).find(([code]) =>
      error.message.includes(code),
    )?.[1];
    if (entry) return apiError(...entry);
    return apiError(
      "SAVE_FAILED",
      500,
      "No pudimos guardar la visita. Intenta de nuevo.",
    );
  }
  return NextResponse.json(data, {
    status: data?.outcome === "recorded" ? 201 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
