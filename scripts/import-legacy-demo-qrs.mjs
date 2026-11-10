import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const source = process.argv[2];
if (!source)
  throw new Error("Uso: pnpm import:demo-qrs RUTA_A_JSON_DE_CODIGOS");
const codes = JSON.parse(await readFile(source, "utf8"));
if (
  !Array.isArray(codes) ||
  codes.length === 0 ||
  codes.length > 100 ||
  codes.some(
    (code) => typeof code !== "string" || !/^[0-9A-F]{16}$/.test(code),
  ) ||
  new Set(codes).size !== codes.length
) {
  throw new Error(
    "El JSON debe contener códigos únicos de 16 caracteres hexadecimales en mayúsculas.",
  );
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret)
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function find(table, column, value) {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data;
}
async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw error;
  return data;
}
const site = await find("sites", "code", "K66-DEMO");
if (!site) throw new Error("Primero ejecuta pnpm bootstrap:demo.");
const { data: gate, error: gateError } = await db
  .from("gates")
  .select("*")
  .eq("site_id", site.id)
  .eq("code", "CENTRAL-DEMO")
  .single();
if (gateError) throw gateError;
const area =
  (await find("areas", "code", "PDF-2021")) ??
  (await insert("areas", {
    site_id: site.id,
    code: "PDF-2021",
    name: "QR existentes · ubicación por definir",
  }));

let template = await db
  .from("patrol_templates")
  .select("*")
  .eq("gate_id", gate.id)
  .eq("name", "Ronda QR 2021")
  .maybeSingle();
if (template.error) throw template.error;
template =
  template.data ??
  (await insert("patrol_templates", {
    gate_id: gate.id,
    name: "Ronda QR 2021",
    is_default: false,
  }));

for (const [index, code] of codes.entries()) {
  const number = String(index + 1).padStart(2, "0");
  const checkpointCode = `K66-PDF-${number}`;
  const checkpoint =
    (await find("checkpoints", "code", checkpointCode)) ??
    (await insert("checkpoints", {
      area_id: area.id,
      code: checkpointCode,
      name: `Punto ${number}`,
    }));
  if (checkpoint.area_id !== area.id)
    throw new Error(`${checkpointCode} pertenece a otra área.`);
  const assignedLegacy = await find("qr_codes", "legacy_code", code);
  if (assignedLegacy && assignedLegacy.checkpoint_id !== checkpoint.id)
    throw new Error(`El código ${code} ya pertenece a otro punto.`);
  const { data: currentQr, error: qrError } = await db
    .from("qr_codes")
    .select("*")
    .eq("checkpoint_id", checkpoint.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (qrError) throw qrError;
  if (!currentQr) {
    await insert("qr_codes", {
      checkpoint_id: checkpoint.id,
      public_code: randomBytes(16).toString("hex"),
      legacy_code: code,
      version: 1,
    });
  } else if (!currentQr.legacy_code) {
    const { error } = await db
      .from("qr_codes")
      .update({ legacy_code: code })
      .eq("id", currentQr.id);
    if (error) throw error;
  } else if (currentQr.legacy_code !== code) {
    throw new Error(`${checkpointCode} ya tiene otro QR asignado.`);
  }
  const { data: point, error: pointError } = await db
    .from("template_points")
    .select("id")
    .eq("template_id", template.id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();
  if (pointError) throw pointError;
  if (!point)
    await insert("template_points", {
      template_id: template.id,
      checkpoint_id: checkpoint.id,
      position: index + 1,
      required: true,
    });
}

const { error: oldDefaultError } = await db
  .from("patrol_templates")
  .update({ is_default: false })
  .eq("gate_id", gate.id)
  .eq("is_default", true)
  .neq("id", template.id);
if (oldDefaultError) throw oldDefaultError;
const { error: newDefaultError } = await db
  .from("patrol_templates")
  .update({ is_default: true })
  .eq("id", template.id);
if (newDefaultError) throw newDefaultError;
console.log(
  `Importados ${codes.length} QR del PDF como puntos de la ronda predeterminada de DEMO-001.`,
);
