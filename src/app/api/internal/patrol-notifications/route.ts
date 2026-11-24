import { timingSafeEqual } from "node:crypto";
import { sendNotification } from "web-push";
import {
  getPushConfig,
  isAllowedPushEndpoint,
} from "@/lib/notifications/push-config";
import { noticeLabels } from "@/lib/notifications/labels";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type Claim = { delivery_id: string; token: string };
type Delivery = {
  notification_id: string;
  kind: string;
  expires_at: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

function authorized(request: Request, secret: string) {
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

function retryDelay(value?: string) {
  if (!value) return null;
  const numeric = Number(value);
  const delay = Number.isFinite(numeric)
    ? numeric
    : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(delay)
    ? Math.max(0, Math.ceil(Math.min(1800, delay)))
    : null;
}

export async function POST(request: Request) {
  const config = getPushConfig();
  if (!config || !authorized(request, config.secret))
    return new Response(null, { status: 404 });
  const db = createAdminSupabaseUntyped();
  const claimed = await db.rpc("claim_push_deliveries", { p_limit: 12 });
  if (claimed.error) return Response.json({ ok: false }, { status: 503 });

  const results = await Promise.allSettled(
    (claimed.data as Claim[]).map(async (claim) => {
      const current = await db.rpc("get_claimed_push", {
        p_id: claim.delivery_id,
        p_token: claim.token,
      });
      if (current.error) throw new Error("claim check");
      const delivery = (current.data as Delivery[])[0];
      let result = "cancelled";
      let status: number | null = null;
      let delay: number | null = null;
      if (delivery && isAllowedPushEndpoint(delivery.endpoint)) {
        const ttl = Math.floor(
          (Date.parse(delivery.expires_at) - Date.now()) / 1000,
        );
        if (ttl > 0) {
          try {
            const response = await sendNotification(
              {
                endpoint: delivery.endpoint,
                keys: { p256dh: delivery.p256dh, auth: delivery.auth_key },
              },
              JSON.stringify({
                id: delivery.notification_id,
                body: noticeLabels[delivery.kind] ?? "Tienes un aviso",
              }),
              {
                vapidDetails: {
                  publicKey: config.publicKey,
                  privateKey: config.privateKey,
                  subject: config.subject,
                },
                TTL: Math.min(ttl, 1800),
                timeout: 8000,
                topic: delivery.notification_id.replaceAll("-", ""),
              },
            );
            status = response.statusCode;
            result = "accepted";
          } catch (cause) {
            const error = cause as {
              statusCode?: number;
              headers?: Record<string, string>;
            };
            status = error?.statusCode ?? null;
            delay = retryDelay(error?.headers?.["retry-after"]);
            result =
              status === 404 || status === 410
                ? "gone"
                : status === null || status === 429 || status >= 500
                  ? "retry"
                  : "failed";
          }
        }
      }
      const finished = await db.rpc("finish_push_delivery", {
        p_id: claim.delivery_id,
        p_token: claim.token,
        p_result: result,
        p_status: status,
        p_retry_after: delay,
      });
      if (finished.error) throw new Error("claim finish");
      return result;
    }),
  );
  const counts: Record<string, number> = {};
  for (const result of results) {
    const key = result.status === "fulfilled" ? result.value : "worker_error";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Response.json(counts, { status: counts.worker_error ? 503 : 200 });
}
