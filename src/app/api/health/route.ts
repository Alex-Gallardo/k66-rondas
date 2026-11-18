import { createAdminSupabase } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { error } = await createAdminSupabase()
      .from("sites")
      .select("id")
      .limit(1);
    if (error) throw error;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    console.error(
      JSON.stringify({ event: "health.check", status: "degraded" }),
    );
    return Response.json({ status: "degraded" }, { status: 503, headers });
  }
}
