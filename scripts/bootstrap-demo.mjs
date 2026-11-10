import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function one(table, column, value) {
  const { data, error } = await db.from(table).select("*").eq(column, value).maybeSingle();
  if (error) throw error;
  return data;
}
async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw error;
  return data;
}

const site = await one("sites", "code", "K66-DEMO") ?? await insert("sites", {
  code: "K66-DEMO", name: "Planta de demostración K66", timezone: "America/Guatemala",
});
const { data: existingGate, error: gateError } = await db.from("gates").select("*")
  .eq("site_id", site.id).eq("code", "CENTRAL-DEMO").maybeSingle();
if (gateError) throw gateError;
const gate = existingGate ?? await insert("gates", {
  site_id: site.id, code: "CENTRAL-DEMO", name: "Garita Central",
});
if (!await one("site_settings", "site_id", site.id)) await insert("site_settings", { site_id: site.id });

const points = [
  { areaCode: "ENTRADA-DEMO", area: "Acceso principal", code: "K66-ENTRADA-DEMO", name: "Entrada principal" },
  { areaCode: "BODEGA-DEMO", area: "Bodega", code: "K66-BODEGA-DEMO", name: "Puerta de bodega" },
  { areaCode: "PATIO-DEMO", area: "Patio de carga", code: "K66-PATIO-DEMO", name: "Acceso al patio" },
];
const checkpointIds = [];
for (const point of points) {
  const area = await one("areas", "code", point.areaCode) ?? await insert("areas", {
    site_id: site.id, code: point.areaCode, name: point.area,
  });
  const checkpoint = await one("checkpoints", "code", point.code) ?? await insert("checkpoints", {
    area_id: area.id, code: point.code, name: point.name,
  });
  checkpointIds.push(checkpoint.id);
  const { data: activeQr, error: qrError } = await db.from("qr_codes").select("id")
    .eq("checkpoint_id", checkpoint.id).is("revoked_at", null).maybeSingle();
  if (qrError) throw qrError;
  if (!activeQr) await insert("qr_codes", {
    checkpoint_id: checkpoint.id, public_code: randomBytes(16).toString("hex"), version: 1,
  });
}

const { data: existingTemplate, error: templateError } = await db.from("patrol_templates").select("*")
  .eq("gate_id", gate.id).eq("name", "Ronda de demostración").maybeSingle();
if (templateError) throw templateError;
const template = existingTemplate ?? await insert("patrol_templates", {
  gate_id: gate.id, name: "Ronda de demostración", is_default: true,
});
for (const [index, checkpointId] of checkpointIds.entries()) {
  const { data, error } = await db.from("template_points").select("id")
    .eq("template_id", template.id).eq("checkpoint_id", checkpointId).maybeSingle();
  if (error) throw error;
  if (!data) await insert("template_points", {
    template_id: template.id, checkpoint_id: checkpointId, position: index + 1, required: true,
  });
}

let profile = await one("profiles", "employee_code", "DEMO-001");
let password;
if (!profile) {
  password = randomBytes(12).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email: "demo-001@accounts.k66.example", password, email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("No se creó el usuario Auth.");
  try {
    profile = await insert("profiles", {
      id: data.user.id, employee_code: "DEMO-001", full_name: "Guardia Demo",
      role: "guard", active: true, must_change_password: false,
    });
  } catch (cause) {
    await db.auth.admin.deleteUser(data.user.id);
    throw cause;
  }
}
const { data: assignment, error: assignmentError } = await db.from("gate_assignments")
  .select("id").eq("profile_id", profile.id).eq("gate_id", gate.id).maybeSingle();
if (assignmentError) throw assignmentError;
if (!assignment) await insert("gate_assignments", { profile_id: profile.id, gate_id: gate.id });

console.log(`Demo preparada en ${new URL(url).hostname}: DEMO-001 · ${points.length} QR · garita Central.`);
if (password) console.log(`Contraseña de demostración (guardar fuera del repositorio): ${password}`);
else console.log("La cuenta ya existía; no se cambió su contraseña.");
