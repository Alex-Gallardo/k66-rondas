import "server-only";

import type { Actor } from "@/lib/auth";
import { assignedGateIds } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function getGuardCurrent(actor: Actor) {
  const db = createAdminSupabase();
  const gateIds = await assignedGateIds(actor);
  const gatesResult = gateIds.length
    ? await db
        .from("gates")
        .select("id,name,code")
        .in("id", gateIds)
        .eq("active", true)
        .order("name")
    : { data: [], error: null };
  if (gatesResult.error) throw gatesResult.error;

  const { data: shift, error: shiftError } = await db
    .from("shifts")
    .select("id,gate_id,gate_name_snapshot,started_at")
    .eq("guard_id", actor.id)
    .is("ended_at", null)
    .maybeSingle();
  if (shiftError) throw shiftError;
  if (!shift)
    return {
      gates: gatesResult.data ?? [],
      shift: null,
      timezone: null,
      templates: [],
      patrol: null,
    };

  const { data: gate, error: gateError } = await db
    .from("gates")
    .select("site_id")
    .eq("id", shift.gate_id)
    .single();
  if (gateError) throw gateError;
  const { data: site, error: siteError } = await db
    .from("sites")
    .select("timezone")
    .eq("id", gate.site_id)
    .single();
  if (siteError) throw siteError;

  const { data: templates, error: templateError } = await db
    .from("patrol_templates")
    .select("id,name,is_default")
    .eq("gate_id", shift.gate_id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("name");
  if (templateError) throw templateError;

  const { data: patrol, error: patrolError } = await db
    .from("patrols")
    .select("id,template_id,started_at,status")
    .eq("shift_id", shift.id)
    .eq("status", "in_progress")
    .maybeSingle();
  if (patrolError) throw patrolError;
  if (!patrol)
    return {
      gates: gatesResult.data ?? [],
      shift,
      timezone: site.timezone,
      templates: templates ?? [],
      patrol: null,
    };

  const { data: expected, error: expectedError } = await db
    .from("patrol_expected_points")
    .select(
      "checkpoint_id,checkpoint_name_snapshot,area_name_snapshot,position,required",
    )
    .eq("patrol_id", patrol.id)
    .order("position");
  if (expectedError) throw expectedError;
  const { data: visits, error: visitsError } = await db
    .from("visits")
    .select("checkpoint_id")
    .eq("patrol_id", patrol.id);
  if (visitsError) throw visitsError;
  const visited = new Set((visits ?? []).map((visit) => visit.checkpoint_id));
  return {
    gates: gatesResult.data ?? [],
    shift,
    timezone: site.timezone,
    templates: templates ?? [],
    patrol: {
      ...patrol,
      points: (expected ?? []).map((point) => ({
        ...point,
        visited: visited.has(point.checkpoint_id),
      })),
    },
  };
}
