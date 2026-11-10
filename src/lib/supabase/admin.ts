import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { secretKey, supabaseUrl } from "./env";

export function createAdminSupabase() {
  return createClient<Database>(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Las operaciones genéricas de catálogo y RPC conservan la validación de
// entrada en Zod; este cliente evita uniones de tablas que TypeScript no puede
// inferir a partir de un parámetro de ruta dinámico.
export function createAdminSupabaseUntyped() {
  return createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
