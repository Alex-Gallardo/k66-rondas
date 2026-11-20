import { apiActor, apiError, isApiError } from "@/lib/api";
import {
  getRoundBatch,
  getRoundScope,
  MAX_ROUNDS_EXPORT,
  parseRoundFilters,
  resolveRoundSite,
  roundQuery,
} from "@/lib/admin/rounds";
import {
  addExportRow,
  addExportSheet,
  createExportWorkbook,
  exportOrigin,
  exportTime,
  workbookResponse,
} from "@/lib/admin/excel";

export const runtime = "nodejs";

const MAX_POINTS = 20_000;
const BATCH_SIZE = 100;
const QUERY_PAGE_SIZE = 500;

export async function GET(request: Request) {
  const actor = await apiActor(["admin", "supervisor"]);
  if (isApiError(actor)) return actor;

  try {
    const scope = await getRoundScope(actor);
    const filters = parseRoundFilters(new URL(request.url).searchParams);
    const site = resolveRoundSite(scope, filters);
    const first = await roundQuery(scope, filters).range(0, 0);
    if (first.error) throw first.error;
    const total = first.count ?? 0;
    if (total > MAX_ROUNDS_EXPORT)
      return apiError(
        "EXPORT_LIMIT",
        413,
        `Hay más de ${MAX_ROUNDS_EXPORT} rondas. Acota los filtros o el período para exportar.`,
      );

    const workbook = createExportWorkbook();
    const roundsSheet = addExportSheet(workbook, "Rondas", [
      { header: "ID ronda", key: "id", width: 38 },
      { header: "Sede", key: "site", width: 25 },
      { header: "Garita", key: "gate", width: 25 },
      { header: "Código guardia", key: "employeeCode", width: 20 },
      { header: "Guardia", key: "guard", width: 30 },
      { header: "Estado", key: "status", width: 17 },
      { header: "Inicio local", key: "started", width: 23 },
      { header: "Cierre local", key: "ended", width: 23 },
      { header: "Zona horaria", key: "timezone", width: 25 },
      { header: "Duración min", key: "duration", width: 17 },
      { header: "Tipo duración", key: "durationType", width: 19 },
      { header: "Motivo de cierre", key: "reason", width: 45 },
      { header: "Puntos esperados", key: "expected", width: 20 },
      { header: "Puntos visitados", key: "visited", width: 20 },
      { header: "Obligatorios", key: "required", width: 18 },
      { header: "Obligatorios visitados", key: "requiredVisited", width: 24 },
      { header: "Cobertura %", key: "coverage", width: 17 },
      { header: "Detalle", key: "link", width: 20 },
    ]);
    const pointsSheet = addExportSheet(workbook, "Puntos", [
      { header: "ID ronda", key: "roundId", width: 38 },
      { header: "Orden", key: "position", width: 12 },
      { header: "Punto histórico", key: "point", width: 30 },
      { header: "Área histórica", key: "area", width: 30 },
      { header: "Obligatorio", key: "required", width: 17 },
      { header: "Visitado", key: "visited", width: 17 },
      { header: "Fecha visita local", key: "visitedAt", width: 23 },
      { header: "Zona horaria", key: "timezone", width: 25 },
      { header: "Detalle", key: "link", width: 20 },
    ]);
    const criteriaSheet = addExportSheet(workbook, "Criterios", [
      { header: "Criterio", key: "name", width: 28 },
      { header: "Valor", key: "value", width: 50 },
    ]);
    const exportedAt = new Date();
    const origin = exportOrigin(request);
    const statusNames = {
      in_progress: "En curso",
      completed: "Completada",
      incomplete: "Incompleta",
    } as const;
    let exportedRounds = 0;
    let exportedPoints = 0;

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const batch = await getRoundBatch(scope, filters, offset, BATCH_SIZE);
      const ids = batch.rounds.map((round) => round.id);
      if (!ids.length) break;
      const timezones = new Map(
        batch.rounds.map((round) => [round.id, round.gates.sites.timezone]),
      );

      for (const round of batch.rounds) {
        const timezone = round.gates.sites.timezone;
        const expected = round.progress.expected_total ?? 0;
        const visited = round.progress.visited_total ?? 0;
        const duration = Math.max(
          0,
          Math.floor(
            ((round.ended_at
              ? new Date(round.ended_at).getTime()
              : exportedAt.getTime()) -
              new Date(round.started_at).getTime()) /
              60_000,
          ),
        );
        addExportRow(roundsSheet, {
          id: round.id,
          site: round.gates.sites.name,
          gate: round.shifts.gate_name_snapshot,
          employeeCode: round.profiles.employee_code,
          guard: round.profiles.full_name,
          status:
            statusNames[round.status as keyof typeof statusNames] ??
            round.status,
          started: exportTime(round.started_at, timezone),
          ended: exportTime(round.ended_at, timezone),
          timezone,
          duration,
          durationType: round.ended_at ? "Cerrada" : "Transcurrido al corte",
          reason: round.closure_reason,
          expected,
          visited,
          required: round.progress.required_total ?? 0,
          requiredVisited: round.progress.required_visited ?? 0,
          coverage: expected ? Math.round((visited / expected) * 1000) / 10 : 0,
          link: {
            text: "Abrir ronda",
            hyperlink: `${origin}/admin/rounds/${round.id}`,
          },
        });
        exportedRounds++;
      }

      const visitsByPoint = new Map<string, string>();
      for (let page = 0; ; page += QUERY_PAGE_SIZE) {
        const visits = await scope.db
          .from("visits")
          .select("patrol_id,checkpoint_id,recorded_at")
          .in("patrol_id", ids)
          .order("patrol_id")
          .order("checkpoint_id")
          .range(page, page + QUERY_PAGE_SIZE - 1);
        if (visits.error) throw visits.error;
        for (const visit of visits.data ?? [])
          visitsByPoint.set(
            `${visit.patrol_id}:${visit.checkpoint_id}`,
            visit.recorded_at,
          );
        if (!visits.data || visits.data.length < QUERY_PAGE_SIZE) break;
      }

      for (let page = 0; ; page += QUERY_PAGE_SIZE) {
        const points = await scope.db
          .from("patrol_expected_points")
          .select(
            "patrol_id,checkpoint_id,position,required,checkpoint_name_snapshot,area_name_snapshot",
          )
          .in("patrol_id", ids)
          .order("patrol_id")
          .order("position")
          .range(page, page + QUERY_PAGE_SIZE - 1);
        if (points.error) throw points.error;
        for (const point of points.data ?? []) {
          if (++exportedPoints > MAX_POINTS)
            return apiError(
              "EXPORT_LIMIT",
              413,
              `Hay más de ${MAX_POINTS} puntos. Acota los filtros o el período para exportar.`,
            );
          const visitTime = visitsByPoint.get(
            `${point.patrol_id}:${point.checkpoint_id}`,
          );
          const timezone =
            timezones.get(point.patrol_id) ?? "America/Guatemala";
          addExportRow(pointsSheet, {
            roundId: point.patrol_id,
            position: point.position,
            point: point.checkpoint_name_snapshot,
            area: point.area_name_snapshot,
            required: point.required ? "Sí" : "No",
            visited: visitTime ? "Sí" : "No",
            visitedAt: exportTime(visitTime ?? null, timezone),
            timezone,
            link: {
              text: "Abrir ronda",
              hyperlink: `${origin}/admin/rounds/${point.patrol_id}`,
            },
          });
        }
        if (!points.data || points.data.length < QUERY_PAGE_SIZE) break;
      }
    }

    if (exportedRounds !== total)
      return apiError(
        "EXPORT_CHANGED",
        409,
        "Las rondas cambiaron durante la exportación. Inténtalo de nuevo.",
      );

    for (const [name, value] of [
      ["Exportado al", exportedAt.toISOString()],
      ["Sede", site?.name ?? "Todas las sedes permitidas"],
      [
        "Garita",
        scope.gates.find((gate) => gate.id === filters.gate)?.name ?? "Todas",
      ],
      ["Guardia ID", filters.guard || "Todos"],
      ["Estado", filters.status || "Todos"],
      ["Inicio desde", filters.from || "Sin límite"],
      ["Inicio hasta", filters.to || "Sin límite"],
      ["Rondas", String(exportedRounds)],
      ["Puntos", String(exportedPoints)],
      ["Duración abierta", "Calculada al momento de exportación"],
    ])
      addExportRow(criteriaSheet, { name, value });

    return workbookResponse(
      workbook,
      `k66-rondas-${exportedAt.toISOString().slice(0, 10)}.xlsx`,
    );
  } catch (cause) {
    if (
      cause instanceof Error &&
      /filtro|fecha|sede|página|estado/i.test(cause.message)
    )
      return apiError("INVALID_FILTERS", 400, cause.message);
    console.error("Error al exportar rondas XLSX", cause);
    return apiError("EXPORT_ERROR", 500, "No se pudo exportar las rondas.");
  }
}
