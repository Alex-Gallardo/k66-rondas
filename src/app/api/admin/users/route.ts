import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";
import { userInput } from "@/lib/admin/user-schema";
import {
  createAdminSupabase,
  createAdminSupabaseUntyped,
} from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const url = new URL(request.url);
  const page = Math.max(
    1,
    Math.min(10000, Number(url.searchParams.get("page")) || 1),
  );
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const db = createAdminSupabase();
  let query = db
    .from("profiles")
    .select(
      "id,employee_code,full_name,role,active,must_change_password,created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_]/g, "\\$&")}%`);
  const { data, count, error } = await query;
  if (error)
    return apiError("SERVER_ERROR", 500, "No pudimos cargar los usuarios.");
  const ids = (data ?? []).map((profile) => profile.id);
  const { data: assignments } = ids.length
    ? await db
        .from("gate_assignments")
        .select("profile_id,gate_id")
        .in("profile_id", ids)
        .eq("active", true)
    : { data: [] };
  const items = (data ?? []).map((profile) => ({
    ...profile,
    gate_ids: (assignments ?? [])
      .filter((entry) => entry.profile_id === profile.id)
      .map((entry) => entry.gate_id),
  }));
  return NextResponse.json({ items, total: count ?? 0, page, pageSize: 20 });
}

export async function POST(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = userInput.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      parsed.error.issues[0]?.message ?? "Revisa los datos.",
    );
  const input = parsed.data;
  if (input.role !== "admin" && input.gate_ids.length === 0) {
    return apiError("GATE_REQUIRED", 400, "Asigna al menos una garita.");
  }

  const db = createAdminSupabase();
  const email = `${input.employee_code.toLowerCase()}@accounts.k66.example`;
  const temporaryPassword = randomBytes(18).toString("base64url");
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return apiError(
      "USER_CREATE_FAILED",
      400,
      "No pudimos crear la cuenta. Verifica que el código sea único.",
    );
  }

  const operations = createAdminSupabaseUntyped();
  const { error } = await operations.rpc("create_profile_with_gates", {
    p_user_id: created.user.id,
    p_employee_code: input.employee_code,
    p_full_name: input.full_name,
    p_role: input.role,
    p_gate_ids: input.gate_ids,
    p_actor_id: actor.id,
  });
  if (error) {
    await db.auth.admin.deleteUser(created.user.id);
    return apiError(
      "USER_CREATE_FAILED",
      400,
      "No pudimos completar el alta. Revisa las garitas y el código.",
    );
  }
  return NextResponse.json(
    { id: created.user.id, temporary_password: temporaryPassword },
    { status: 201 },
  );
}
