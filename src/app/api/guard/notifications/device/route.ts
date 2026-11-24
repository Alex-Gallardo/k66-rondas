import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import {
  ensurePushDevice,
  getPushDevice,
  pushSessionId,
  revokePushDevice,
} from "@/lib/notifications/device";
import {
  getPushConfig,
  isAllowedPushEndpoint,
} from "@/lib/notifications/push-config";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    endpoint: z.string().max(2048).refine(isAllowedPushEndpoint),
    keys: z.object({
      p256dh: z.string().regex(/^[\w-]{87}$/),
      auth: z.string().regex(/^[\w-]{22}$/),
    }),
  }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("test") }),
]);

export async function GET() {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const config = getPushConfig();
  const [device, session] = await Promise.all([
    getPushDevice(),
    pushSessionId(actor.id),
  ]);
  if (!config || !device || !session)
    return Response.json(
      { active: false, publicKey: config?.publicKey ?? null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const result = await createAdminSupabaseUntyped()
    .from("push_subscriptions")
    .select("id")
    .eq("device_id", device)
    .eq("guard_id", actor.id)
    .eq("session_id", session)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (result.error)
    return apiError(
      "PUSH_STATUS_FAILED",
      500,
      "No pudimos consultar este dispositivo.",
    );
  return Response.json(
    { active: !!result.data, publicKey: config.publicKey },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const input = action.safeParse(await readJson(request));
  if (!input.success)
    return apiError(
      "INVALID_PUSH",
      400,
      "Esta suscripción de navegador no es compatible.",
    );
  const session = await pushSessionId(actor.id);
  if (!session)
    return apiError("INVALID_SESSION", 401, "Inicia sesión de nuevo.");
  if (input.data.action === "disable") {
    try {
      await revokePushDevice(actor.id, session);
      return Response.json({ ok: true });
    } catch {
      return apiError(
        "PUSH_DISABLE_FAILED",
        500,
        "No pudimos desactivar este dispositivo. Intenta de nuevo.",
      );
    }
  }
  if (!getPushConfig())
    return apiError(
      "PUSH_DISABLED",
      503,
      "Los avisos Push aún no están habilitados en este entorno.",
    );
  const db = createAdminSupabaseUntyped();
  const device =
    input.data.action === "subscribe"
      ? await ensurePushDevice()
      : await getPushDevice();
  if (!device)
    return apiError(
      "NO_ACTIVE_PUSH",
      409,
      "Activa los avisos en este dispositivo primero.",
    );
  const result =
    input.data.action === "subscribe"
      ? await db.rpc("register_push_device", {
          p_device: device,
          p_guard: actor.id,
          p_session: session,
          p_endpoint: input.data.endpoint,
          p_key: input.data.keys.p256dh,
          p_auth: input.data.keys.auth,
        })
      : await db.rpc("queue_test_notification", {
          p_device: device,
          p_guard: actor.id,
          p_session: session,
        });
  if (result.error?.message.includes("TEST_RATE_LIMIT"))
    return apiError(
      "TEST_RATE_LIMIT",
      429,
      "Espera dos minutos entre avisos de prueba.",
    );
  if (result.error?.message.includes("NO_ACTIVE_PUSH"))
    return apiError(
      "NO_ACTIVE_PUSH",
      409,
      "Activa los avisos en este dispositivo primero.",
    );
  if (result.error?.message.includes("PUSH_DEVICE_LIMIT"))
    return apiError(
      "PUSH_DEVICE_LIMIT",
      409,
      "Esta cuenta ya tiene cinco dispositivos activos.",
    );
  if (result.error?.message.includes("DEVICE_SESSION_CHANGED"))
    return apiError(
      "DEVICE_SESSION_CHANGED",
      409,
      "Cambió la sesión de este dispositivo. Entra de nuevo antes de activar los avisos.",
    );
  if (result.error)
    return apiError(
      "PUSH_FAILED",
      500,
      "No pudimos completar la solicitud de avisos.",
    );
  return Response.json({ ok: true });
}
