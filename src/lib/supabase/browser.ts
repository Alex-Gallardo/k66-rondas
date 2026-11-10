"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publishableKey, supabaseUrl } from "./env";

export function createBrowserSupabase() {
  return createBrowserClient<Database>(supabaseUrl(), publishableKey());
}
