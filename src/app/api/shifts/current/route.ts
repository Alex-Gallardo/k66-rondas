import { NextResponse } from "next/server";
import { apiActor, isApiError, apiError } from "@/lib/api";
import { getGuardCurrent } from "@/lib/guard/current";

export async function GET() {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  try {
    return NextResponse.json(await getGuardCurrent(actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError("SERVER_ERROR", 500, "No pudimos cargar tu turno.");
  }
}
