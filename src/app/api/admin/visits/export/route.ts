import { apiActor, apiError, isApiError } from "@/lib/api";
import {
  formatVisitTime,
  getVisitScope,
  parseVisitFilters,
  resolveVisitSite,
  visitQuery,
} from "@/lib/admin/visits";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Evita que notas y nombres se conviertan en fórmulas al abrir el CSV.
  const safe =
    typeof value === "string" && /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const actor = await apiActor(["admin", "supervisor"]);
  if (isApiError(actor)) return actor;
  const scope = await getVisitScope(actor);
  let filters;
  try {
    filters = parseVisitFilters(new URL(request.url).searchParams);
    resolveVisitSite(scope, filters);
  } catch (cause) {
    return apiError(
      "INVALID_FILTERS",
      400,
      cause instanceof Error ? cause.message : "Filtros inválidos.",
    );
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            "\uFEFF" +
              [
                "ID",
                "Fecha local",
                "Sede",
                "Garita",
                "Código guardia",
                "Guardia",
                "Punto",
                "Área",
                "Estado GPS",
                "Latitud",
                "Longitud",
                "Precisión m",
                "GPS obtenido",
                "IP pública",
                "Observación",
                "Fotografía",
              ]
                .map(csvCell)
                .join(",") +
              "\r\n",
          ),
        );
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await visitQuery(scope, filters).range(
            offset,
            offset + 499,
          );
          if (error) throw error;
          for (const visit of data ?? []) {
            const zone = visit.gates.sites.timezone;
            controller.enqueue(
              encoder.encode(
                [
                  visit.id,
                  formatVisitTime(visit.recorded_at, zone),
                  visit.gates.sites.name,
                  visit.gates.name,
                  visit.profiles.employee_code,
                  visit.profiles.full_name,
                  visit.checkpoint_name_snapshot,
                  visit.area_name_snapshot,
                  visit.geo_status,
                  visit.latitude,
                  visit.longitude,
                  visit.accuracy_m,
                  visit.geo_captured_at
                    ? formatVisitTime(visit.geo_captured_at, zone)
                    : "",
                  visit.client_ip,
                  visit.note,
                  visit.visit_photos ? "Sí" : "No",
                ]
                  .map(csvCell)
                  .join(",") + "\r\n",
              ),
            );
          }
          if (!data || data.length < 500) break;
        }
        controller.close();
      } catch (cause) {
        controller.error(cause);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="k66-visitas.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
