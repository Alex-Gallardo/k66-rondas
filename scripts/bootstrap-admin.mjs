import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const code = process.env.BOOTSTRAP_ADMIN_CODE?.trim().toUpperCase();
const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code) || !fullName || fullName.length < 3) {
  throw new Error("Define BOOTSTRAP_ADMIN_CODE y BOOTSTRAP_ADMIN_NAME válidos para crear el primer admin.");
}
if (!url || !secret) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { count, error: countError } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
if (countError) throw countError;
if (count) throw new Error("Ya existe un administrador activo. Usa el panel para crear otra cuenta.");

const password = randomBytes(18).toString("base64url");
const email = `${code.toLowerCase()}@accounts.k66.example`;
const { data: created, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (authError || !created.user) throw authError ?? new Error("No pudimos crear la cuenta Auth.");

const { error: profileError } = await db.from("profiles").insert({
  id: created.user.id,
  employee_code: code,
  full_name: fullName,
  role: "admin",
  active: true,
  must_change_password: true,
});
if (profileError) {
  await db.auth.admin.deleteUser(created.user.id);
  throw profileError;
}
await db.from("audit_events").insert({ action: "admin.bootstrap", entity_type: "profile", entity_id: created.user.id });

console.log(`Administrador creado: ${fullName} (${code})`);
console.log(`Contraseña temporal: ${password}`);
console.log("Entrégala en persona. Se exigirá cambiarla en el primer acceso.");
