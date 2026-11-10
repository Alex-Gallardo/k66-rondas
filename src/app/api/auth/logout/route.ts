import { NextResponse } from "next/server";
import { checkMutationRequest } from "@/lib/api";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const session = await createServerSupabase();
  await session.auth.signOut();
  return NextResponse.json({ destination: "/login" });
}
