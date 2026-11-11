import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";

export async function guardGeoEnabled(guardId: string): Promise<boolean> {
  const db = createAdminSupabase();
  const { data: shift, error: shiftError } = await db
    .from("shifts")
    .select("gate_id")
    .eq("guard_id", guardId)
    .is("ended_at", null)
    .maybeSingle();
  if (shiftError) throw shiftError;
  // record_visit permite reintentar una clave idempotente aun si el turno terminó.
  // En ese caso la política ya no puede modificar la visita guardada.
  if (!shift) return true;
  const { data: gate, error: gateError } = await db
    .from("gates")
    .select("site_id")
    .eq("id", shift.gate_id)
    .single();
  if (gateError) throw gateError;
  const { data: settings, error: settingsError } = await db
    .from("site_settings")
    .select("geo_enabled")
    .eq("site_id", gate.site_id)
    .maybeSingle();
  if (settingsError) throw settingsError;
  return settings?.geo_enabled ?? true;
}
