import "server-only";

import { createAdminSupabaseUntyped } from "@/lib/supabase/admin";

export const occurrenceColumns =
  "id,gate_id,guard_id,status,scheduled_at,remind_at,start_until,finish_by,timezone,assignment_issue,patrol_id,gate:gates(name),template:patrol_templates(name),guard:profiles(full_name,employee_code)";

export type Occurrence = {
  id: string;
  gate_id: string;
  guard_id: string | null;
  status: string;
  scheduled_at: string;
  remind_at: string;
  start_until: string;
  finish_by: string;
  timezone: string;
  assignment_issue: string | null;
  patrol_id: string | null;
  gate: { name: string };
  template: { name: string };
  guard: { full_name: string; employee_code: string } | null;
};

export type Notice = {
  id: string;
  occurrence_id: string | null;
  kind: string;
  created_at: string;
  read_at: string | null;
  cancelled_at: string | null;
};

export async function getGuardNotices(guardId: string) {
  const db = createAdminSupabaseUntyped();
  const result = await db
    .from("notifications")
    .select("id,occurrence_id,kind,created_at,read_at,cancelled_at")
    .eq("guard_id", guardId)
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (result.error) throw result.error;
  return result.data as Notice[];
}

export async function getGuardAgenda(guardId: string) {
  const db = createAdminSupabaseUntyped();
  const now = new Date().toISOString();
  const result = await db
    .from("patrol_occurrences")
    .select(occurrenceColumns)
    .eq("guard_id", guardId)
    .or(`status.eq.in_progress,and(status.eq.scheduled,start_until.gt.${now})`)
    .order("scheduled_at")
    .limit(30);
  if (result.error) throw result.error;
  return result.data as unknown as Occurrence[];
}

export async function getGuardNotificationSummary(guardId: string) {
  const db = createAdminSupabaseUntyped();
  const [agenda, unread] = await Promise.all([
    getGuardAgenda(guardId),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("guard_id", guardId)
      .is("read_at", null)
      .is("cancelled_at", null)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  if (unread.error) throw unread.error;
  return { agenda, unread: unread.count ?? 0 };
}
