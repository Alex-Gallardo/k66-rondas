import { expect, test, type Page } from "@playwright/test";

const siteId = "10000000-0000-4000-8000-000000000001";
const centralGateId = "20000000-0000-4000-8000-000000000001";
const otherGateId = "20000000-0000-4000-8000-000000000002";
const password = "E2E-test-password-123";

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(code.includes("GUARD") ? /\/app$/ : /\/admin$/);
}

test.describe("T-18 · rondas completas", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y datos ficticios de CI.",
  );

  test("admin filtra y distingue punto opcional de estado completado", async ({
    page,
  }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/rounds");
    await page.locator('select[name="site"]').selectOption(siteId);
    await page.locator('select[name="gate"]').selectOption(centralGateId);
    await page
      .locator('select[name="guard"]')
      .selectOption({ label: "Guardia Rondas SQL · E2E-T18-SQL" });
    await page.locator('select[name="status"]').selectOption("completed");
    await page.locator('input[name="from"]').fill("2020-01-01");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    await expect(
      page
        .locator("article:visible, tr:visible", { hasText: "1/2 puntos" })
        .first(),
    ).toBeVisible();
    await page.locator('a[href^="/admin/rounds/"]:visible').first().click();
    await expect(
      page.getByRole("heading", { name: "Garita Central" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Resumen de ronda" }).getByText("1/2"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Resumen de ronda" }).getByText("1/1"),
    ).toBeVisible();
    await expect(page.getByText("Opcional pendiente")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver registro y ubicación" }),
    ).toHaveAttribute("href", /\/admin\/visits\//);
  });

  test("ronda incompleta muestra puntos faltantes y motivo", async ({
    page,
  }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/rounds");
    await page
      .locator('select[name="guard"]')
      .selectOption({ label: "Guardia SQL · E2E-T11-SQL" });
    await page.locator('select[name="status"]').selectOption("incomplete");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("1 resultado", { exact: false })).toBeVisible();
    await page.locator('a[href^="/admin/rounds/"]:visible').first().click();
    await expect(
      page
        .getByRole("region", { name: "Cierre incompleto" })
        .getByText("Acceso restringido"),
    ).toBeVisible();
    await expect(
      page.getByText("2 puntos obligatorios pendientes"),
    ).toBeVisible();
  });

  test("supervisor no abre una ronda de otra garita", async ({
    page,
    browser,
  }) => {
    await login(page, "E2E-ADMIN");
    await page.goto(`/admin/rounds?site=${siteId}&gate=${otherGateId}`);
    const href = await page
      .locator('a[href^="/admin/rounds/"]:visible')
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();

    const context = await browser.newContext();
    try {
      const supervisor = await context.newPage();
      await login(supervisor, "E2E-SUPERVISOR");
      await supervisor.goto(`/admin/rounds?site=${siteId}&gate=${otherGateId}`);
      await expect(
        supervisor.getByText("0 resultados", { exact: false }),
      ).toBeVisible();
      const response = await supervisor.goto(href!);
      expect(response?.status()).toBe(404);
      await supervisor.goto(
        `/admin/rounds?site=${siteId}&gate=${centralGateId}`,
      );
      await expect(
        supervisor.getByRole("heading", { name: "Rondas", exact: true }),
      ).toBeVisible();
      await expect(
        supervisor.locator('a[href^="/admin/rounds/"]:visible').first(),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
