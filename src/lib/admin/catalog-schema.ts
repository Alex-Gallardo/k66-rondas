import { z } from "zod";

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_-]{2,32}$/,
    "Usa 2–32 letras, números, guiones o guion bajo.",
  );
const name = z
  .string()
  .trim()
  .min(2, "Escribe un nombre de al menos 2 caracteres.")
  .max(100);
const uuid = z.uuid();

export const siteSchema = z.object({
  code,
  name,
  timezone: z.string().trim().min(1).max(80),
});

export const gateSchema = z.object({ site_id: uuid, code, name });
export const areaSchema = z.object({
  site_id: uuid,
  parent_id: uuid.nullable(),
  code,
  name,
});
export const checkpointSchema = z.object({
  area_id: uuid,
  code,
  name,
  description: z.string().trim().max(500).nullable(),
});

export const schemas = {
  sites: siteSchema,
  gates: gateSchema,
  areas: areaSchema,
  checkpoints: checkpointSchema,
};

export type CatalogResource = keyof typeof schemas;

export function isCatalogResource(value: string): value is CatalogResource {
  return value in schemas;
}
