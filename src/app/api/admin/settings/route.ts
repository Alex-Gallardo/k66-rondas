import { z } from "zod";
import {
  apiActor,
  apiError,
  checkMutationRequest,
  isApiError,
  readJson,
} from "@/lib/api";

const schema = z.strictObject({ site_id: z.uuid(), geo_enabled: z.boolean() });

export async function PATCH(request: Request) {
  const actor = await apiActor(["admin"]);
  if (isApiError(actor)) return actor;
  const invalid = checkMutationRequest(request);
  if (invalid) return invalid;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      400,
      "Revisa la sede y la política GPS.",
    );
  return apiError(
    "GPS_REQUIRED",
    409,
    "La ubicación GPS ahora es obligatoria en todas las sedes.",
  );
}
