import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { publishableKey, supabaseUrl } from "./env";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; proxy.ts refresca la sesión.
        }
      },
    },
  });
}
