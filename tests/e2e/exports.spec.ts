import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const siteId = "10000000-0000-4000-8000-000000000001";
const centralGateId = "20000000-0000-4000-8000-000000000001";
const otherGateId = "20000000-0000-4000-8000-000000000002";

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function readWorkbook(page: Page, href: string) {
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("spreadsheetml.sheet");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await response.body()) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0],
  );
  return workbook;
}

test.describe("Exportaciones de registros y rondas", () => {
  test.skip(!process.env.E2E_PHASE2, "Requiere Supabase local y datos de CI.");

  test("filtra evidencia y exporta todas las visitas filtradas", async ({
    page,
  }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/visits");
    await page.locator('select[name="site"]').selectOption(siteId);
    await page.locator('select[name="gate"]').selectOption(centralGateId);
    await page.locator('select[name="guard"]').selectOption({
      label: "Guardia Visitas SQL · E2E-T12-SQL",
    });
    await page.locator('select[name="evidence"]').selectOption("photo");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    const excelHref = await page
      .getByRole("link", { name: "Exportar Excel" })
      .getAttribute("href");
    expect(excelHref).toContain("evidence=photo");
    const workbook = await readWorkbook(page, excelHref!);
    const sheet = workbook.getWorksheet("Registros");
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getRow(2).getCell(11).value).toBe("Sí");
    expect(sheet?.getRow(2).getCell(12).value).toMatchObject({
      text: "Abrir foto",
    });

    await page.locator('select[name="evidence"]').selectOption("note");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByText("2 resultados", { exact: false }),
    ).toBeVisible();
    const noteHref = await page
      .getByRole("link", { name: "Exportar Excel" })
      .getAttribute("href");
    const notes = await readWorkbook(page, noteHref!);
    expect(notes.getWorksheet("Registros")?.rowCount).toBe(3);
    const noteValues = [2, 3].map(
      (row) =>
        notes.getWorksheet("Registros")?.getRow(row).getCell(10).value,
    );
    expect(noteValues).toContain("'=SUM(1,1)");

    await page.locator('select[name="evidence"]').selectOption("any");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByText("2 resultados", { exact: false }),
    ).toBeVisible();

    await page.locator('select[name="evidence"]').selectOption("both");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    const csvHref = await page
      .getByRole("link", { name: "Exportar CSV" })
      .getAttribute("href");
    const csv = await page.request.get(csvHref!);
    expect((await csv.text()).trim().split("\r\n")).toHaveLength(2);
  });

  test("exporta resumen y puntos de la ronda filtrada", async ({ page }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/rounds");
    await page.locator('select[name="site"]').selectOption(siteId);
    await page.locator('select[name="gate"]').selectOption(centralGateId);
    await page.locator('select[name="guard"]').selectOption({
      label: "Guardia Rondas SQL · E2E-T18-SQL",
    });
    await page.locator('select[name="status"]').selectOption("completed");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    const href = await page
      .getByRole("link", { name: "Exportar Excel" })
      .getAttribute("href");
    const workbook = await readWorkbook(page, href!);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Rondas",
      "Puntos",
      "Criterios",
    ]);
    expect(workbook.getWorksheet("Rondas")?.rowCount).toBe(2);
    expect(
      workbook.getWorksheet("Rondas")?.getRow(2).getCell(13).value,
    ).toBe(2);
    expect(
      workbook.getWorksheet("Rondas")?.getRow(2).getCell(14).value,
    ).toBe(1);
    expect(workbook.getWorksheet("Puntos")?.rowCount).toBe(3);
  });

  test("supervisor no exporta la garita ajena", async ({ page }) => {
    await login(page, "E2E-SUPERVISOR");
    for (const path of ["visits", "rounds"]) {
      const href = `/api/admin/${path}/export/xlsx?site=${siteId}&gate=${otherGateId}`;
      const workbook = await readWorkbook(page, href);
      const firstSheet = workbook.worksheets[0];
      expect(firstSheet.rowCount).toBe(1);
    }
  });
});
