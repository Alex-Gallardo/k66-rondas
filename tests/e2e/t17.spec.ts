import { expect, test } from "@playwright/test";

const siteId = "10000000-0000-4000-8000-000000000001";
const centralGateId = "20000000-0000-4000-8000-000000000001";
const otherGateId = "20000000-0000-4000-8000-000000000002";
const pointId = "40000000-0000-4000-8000-000000000001";

function guatemalaDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function login(page: import("@playwright/test").Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("T-17 · registros y ubicación", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y datos ficticios de CI.",
  );

  test("admin combina filtros y exporta la misma visita con GPS e IP", async ({
    page,
  }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/visits");
    await page.locator('select[name="site"]').selectOption(siteId);
    await page.locator('select[name="gate"]').selectOption(otherGateId);
    await page
      .locator('select[name="guard"]')
      .selectOption({ label: "Guardia Garita Anexa · E2E-T17-OTHER" });
    await page.locator('select[name="point"]').selectOption(pointId);
    const today = guatemalaDate();
    await page.locator('input[name="from"]').fill(today);
    await page.locator('input[name="to"]').fill(today);
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    await expect(page.locator("span:visible", { hasText: "14.634900, -90.506900" }).first()).toBeVisible();
    await expect(page.locator("p:visible", { hasText: "203.0.113.8" }).first()).toBeVisible();

    const detail = page.locator('a[href^="/admin/visits/"]:visible').first();
    await detail.click();
    await expect(
      page.getByRole("heading", { name: "Entrada de bodega" }),
    ).toBeVisible();
    await expect(page.getByText("203.0.113.8")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver en mapa" }),
    ).toHaveAttribute("href", /14\.6349,-90\.5069/);

    await page.goBack();
    const exportLink = page.getByRole("link", { name: "Exportar CSV" });
    const csvResponse = await page.request.get(
      (await exportLink.getAttribute("href")) ?? "",
    );
    expect(csvResponse.status()).toBe(200);
    const csv = await csvResponse.text();
    expect(csv).toContain("203.0.113.8");
    expect(csv).toContain("14.6349");
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });

  test("supervisor solo ve visitas de su garita", async ({ page }) => {
    await login(page, "E2E-SUPERVISOR");
    await page.goto(`/admin/visits?site=${siteId}&gate=${otherGateId}`);
    await expect(
      page.getByText("0 resultados", { exact: false }),
    ).toBeVisible();
    const deniedCsv = await page.request.get(
      `/api/admin/visits/export?site=${siteId}&gate=${otherGateId}`,
    );
    expect(deniedCsv.status()).toBe(200);
    expect((await deniedCsv.text()).trim().split("\r\n")).toHaveLength(1);
    await page.goto(`/admin/visits?site=${siteId}&gate=${centralGateId}`);
    await page.locator('select[name="guard"]').selectOption({ label: "Guardia Visitas SQL · E2E-T12-SQL" });
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByText("2 resultados", { exact: false }),
    ).toBeVisible();
  });

  test("el historial conserva la visita aun cuando se deniega GPS", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Código de empleado").fill("E2E-T12-SQL");
    await page.getByLabel("Contraseña", { exact: true }).fill("E2E-test-password-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/history");
    await expect(page.getByText("GPS: permiso denegado")).toBeVisible();
    await expect(page.getByText("IP pública: 203.0.113.7")).toBeVisible();
    await expect(page.getByText("14.634900, -90.506900")).toBeVisible();
  });
});
