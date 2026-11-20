import "server-only";

import ExcelJS from "exceljs";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ExportCell =
  string | number | null | undefined | ExcelJS.CellHyperlinkValue;

export function createExportWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "K66 Rondas";
  workbook.created = new Date();
  return workbook;
}

export function addExportSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width: number }[],
) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF087F68" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 28;
  return sheet;
}

export function safeExcelText(value: string) {
  return /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
}

export function addExportRow(
  sheet: ExcelJS.Worksheet,
  values: Record<string, ExportCell>,
) {
  const safe = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" ? safeExcelText(value) : (value ?? ""),
    ]),
  );
  sheet.addRow(safe);
}

export function exportTime(value: string | null, timezone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function exportOrigin(request: Request) {
  return new URL(process.env.APP_BASE_URL || request.url).origin;
}

export async function workbookResponse(
  workbook: ExcelJS.Workbook,
  name: string,
) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
