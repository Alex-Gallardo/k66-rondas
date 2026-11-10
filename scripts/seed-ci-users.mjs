import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Los usuarios E2E solo pueden crearse en Supabase local.");
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const gateId = "20000000-0000-4000-8000-000000000001";
const password = "E2E-test-password-123";

for (const fixture of [
  { code: "E2E-ADMIN", name: "Administrador de Pruebas", role: "admin", gates: [], mustChange: false },
  { code: "E2E-GUARD", name: "Guardia de Pruebas", role: "guard", gates: [gateId], mustChange: false },
  { code: "E2E-SUPERVISOR", name: "Supervisor de Pruebas", role: "supervisor", gates: [gateId], mustChange: false },
  { code: "E2E-TEMP", name: "Temporal de Pruebas", role: "guard", gates: [gateId], mustChange: true },
  { code: "E2E-PENDING", name: "Pendiente de Pruebas", role: null, gates: [], mustChange: true },
]) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${fixture.code.toLowerCase()}@accounts.k66.example`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("No pudimos crear el usuario de prueba.");
  if (fixture.role) {
    const { error: profileError } = await db.from("profiles").insert({
      id: data.user.id,
      employee_code: fixture.code,
      full_name: fixture.name,
      role: fixture.role,
      must_change_password: fixture.mustChange,
    });
    if (profileError) throw profileError;
    if (fixture.gates.length) {
      const { error: assignmentError } = await db.from("gate_assignments").insert(fixture.gates.map((gate_id) => ({ profile_id: data.user.id, gate_id })));
      if (assignmentError) throw assignmentError;
    }
  }
}
console.log("Usuarios ficticios de CI creados en Supabase local.");
