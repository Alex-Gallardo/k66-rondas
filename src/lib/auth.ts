import "server-only";

import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type Role = "guard" | "supervisor" | "admin";

export type Actor = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

export async function getActor(): Promise<Actor | null> {
  const session = await createServerSupabase();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return null;

  const admin = createAdminSupabase();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,employee_code,full_name,role,active,must_change_password")
    .eq("id", auth.user.id)
    .single();
  if (error || !profile || !profile.active) return null;

  return {
    id: profile.id,
    employeeCode: profile.employee_code,
    fullName: profile.full_name,
    role: profile.role as Role,
    active: profile.active,
    mustChangePassword: profile.must_change_password,
  };
}

export async function requireActor(roles?: Role[]) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/change-password");
  if (roles && !roles.includes(actor.role))
    redirect(actor.role === "guard" ? "/app" : "/admin");
  return actor;
}

export async function requireAdmin() {
  return requireActor(["admin"]);
}

export async function assignedGateIds(actor: Actor): Promise<string[]> {
  if (actor.role === "admin") return [];
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("gate_assignments")
    .select("gate_id")
    .eq("profile_id", actor.id)
    .eq("active", true);
  if (error) throw error;
  return data.map((entry) => entry.gate_id);
}
