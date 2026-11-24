import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const deviceCookie = "k66-push-installation";

export async function getPushDevice() {
  const store = await cookies();
  const id = z.uuid().safeParse(store.get(deviceCookie)?.value);
  return id.success ? id.data : null;
}

export async function ensurePushDevice() {
  const current = await getPushDevice();
  if (current) return current;
  const id = randomUUID();
  (await cookies()).set(deviceCookie, id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 86400,
  });
  return id;
}

export async function pushSessionId(guardId: string) {
  const db = await createServerSupabase();
  const { data, error } = await db.auth.getClaims();
  const session = z.uuid().safeParse(data?.claims.session_id);
  return !error && data?.claims.sub === guardId && session.success
    ? session.data
    : null;
}

export async function revokePushDevice(
  keepGuard?: string,
  keepSession?: string,
) {
  const device = await getPushDevice();
  if (!device) return;
  let query = createAdminSupabaseUntyped()
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", device)
    .is("revoked_at", null);
  if (keepGuard && keepSession)
    query = query.or(`guard_id.neq.${keepGuard},session_id.neq.${keepSession}`);
  const result = await query;
  if (result.error)
    throw new Error("No pudimos desvincular los avisos de este dispositivo.");
}
