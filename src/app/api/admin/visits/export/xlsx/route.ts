import { apiActor, apiError, isApiError } from "@/lib/api";
import {
  getVisitScope,
  MAX_VISITS_EXPORT,
  parseVisitFilters,
  resolveVisitSite,
  visitQuery,
} from "@/lib/admin/visits";
import {
  addExportRow,
  addExportSheet,
  createExportWorkbook,
  exportOrigin,
  exportTime,
  workbookResponse,
} from "@/lib/admin/excel";

export const runtime = "nodejs";

const BATCH_SIZE = 500;

export async function GET(request: Request) {
  const actor = await apiActor(["admin", "supervisor"]);
  if (isApiError(actor)) return actor;

  try {
    const scope = await getVisitScope(actor);
    const filters = parseVisitFilters(new URL(request.url).searchParams);
    resolveVisitSite(scope, filters);

    const first = await visitQuery(scope, filters).range(0, 0);
    if (first.error) throw first.error;
    const total = first.count ?? 0;
    if (total > MAX_VISITS_EXPORT)
      return apiError(
        "EXPORT_LIMIT",
        413,
        `Hay más de ${MAX_VISITS_EXPORT} registros. Acota los filtros o el período para exportar.`,
      );

    const workbook = createExportWorkbook();
    const sheet = addExportSheet(workbook, "Registros", [
      { header: "ID", key: "id", width: 38 },
      { header: "Fecha local", key: "date", width: 23 },
      { header: "Zona horaria", key: "timezone", width: 25 },
      { header: "Sede", key: "site", width: 25 },
      { header: "Garita", key: "gate", width: 25 },
      { header: "Código guardia", key: "employeeCode", width: 20 },
      { header: "Guardia", key: "guard", width: 30 },
      { header: "Punto", key: "point", width: 25 },
      { header: "Área", key: "area", width: 30 },
      { header: "Observación", key: "note", width: 55 },
      { header: "Foto adjunta", key: "hasPhoto", width: 17 },
      { header: "Enlace a foto", key: "photoLink", width: 22 },
      { header: "Estado GPS", key: "geoStatus", width: 18 },
      { header: "Latitud", key: "latitude", width: 17 },
      { header: "Longitud", key: "longitude", width: 17 },
      { header: "Precisión m", key: "accuracy", width: 16 },
      { header: "GPS obtenido", key: "geoCaptured", width: 23 },
      { header: "IP pública", key: "ip", width: 22 },
    ]);
    const origin = exportOrigin(request);
    let exported = 0;
    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const result = await visitQuery(scope, filters).range(
        offset,
        offset + BATCH_SIZE - 1,
      );
      if (result.error) throw result.error;
      for (const visit of result.data ?? []) {
        const timezone = visit.gates.sites.timezone;
        addExportRow(sheet, {
          id: visit.id,
          date: exportTime(visit.recorded_at, timezone),
          timezone,
          site: visit.gates.sites.name,
          gate: visit.gates.name,
          employeeCode: visit.profiles.employee_code,
          guard: visit.profiles.full_name,
          point: visit.checkpoint_name_snapshot,
          area: visit.area_name_snapshot,
          note: visit.note,
          hasPhoto: visit.has_photo ? "Sí" : "No",
          photoLink: visit.has_photo
            ? {
                text: "Abrir foto",
                hyperlink: `${origin}/api/visits/${visit.id}/photo`,
              }
            : "",
          geoStatus: visit.geo_status,
          latitude: visit.latitude,
          longitude: visit.longitude,
          accuracy: visit.accuracy_m,
          geoCaptured: exportTime(visit.geo_captured_at, timezone),
          ip: visit.client_ip,
        });
        exported++;
      }
    }
    if (exported !== total)
      return apiError(
        "EXPORT_CHANGED",
        409,
        "Los registros cambiaron durante la exportación. Inténtalo de nuevo.",
      );
    return workbookResponse(
      workbook,
      `k66-registros-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  } catch (cause) {
    if (
      cause instanceof Error &&
      /filtro|fecha|sede|página/i.test(cause.message)
    )
      return apiError("INVALID_FILTERS", 400, cause.message);
    console.error("Error al exportar registros XLSX", cause);
    return apiError("EXPORT_ERROR", 500, "No se pudo exportar los registros.");
  }
}
