import { apiActor, apiError, isApiError } from "@/lib/api";
import { getGuardNotificationSummary } from "@/lib/notifications/data";

export async function GET() {
  const actor = await apiActor(["guard"]);
  if (isApiError(actor)) return actor;
  try {
    return Response.json(
      {
        ...(await getGuardNotificationSummary(actor.id)),
        checkedAt: Date.now(),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return apiError("AGENDA_FAILED", 503, "No pudimos actualizar la agenda.");
  }
}
