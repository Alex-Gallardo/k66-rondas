import { expect, test, type Page } from "@playwright/test";

const siteId = "10000000-0000-4000-8000-000000000001";
const otherGateId = "20000000-0000-4000-8000-000000000002";

function localToday() {
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

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("T-19 · dashboard y KPIs", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y datos ficticios de CI.",
  );

  test("admin ve métricas de una garita y sus denominadores", async ({
    page,
  }) => {
    await login(page, "E2E-ADMIN");
    const today = localToday();
    await page.goto(
      `/admin?site=${siteId}&gate=${otherGateId}&from=${today}&to=${today}`,
    );
    const indicators = page.getByRole("region", {
      name: "Indicadores del período",
    });
    await expect(
      indicators
        .getByRole("link", { name: /Visitas registradas/ })
        .locator("p.text-3xl"),
    ).toHaveText("1");
    await expect(
      indicators
        .getByRole("link", { name: /Rondas iniciadas/ })
        .locator("p.text-3xl"),
    ).toHaveText("1");
    await expect(
      indicators
        .getByRole("link", { name: /Rondas completadas/ })
        .locator("p.text-3xl"),
    ).toHaveText("100.0%");
    await expect(
      indicators.getByText("1 de 1 visitas con coordenadas del dispositivo."),
    ).toBeVisible();
    await expect(
      indicators.getByText(
        "1 de 1 guardias actualmente asignados iniciaron turno.",
      ),
    ).toBeVisible();
    await page.getByText("Ver datos diarios del período").click();
    await expect(
      page.getByRole("table").getByRole("row", { name: `${today} 1 1` }),
    ).toBeVisible();
    await expect(page.getByText("Métricas aún sin medición")).toBeVisible();
  });

  test("período sin actividad muestra denominadores cero", async ({ page }) => {
    await login(page, "E2E-ADMIN");
    await page.goto(`/admin?site=${siteId}&from=2020-01-01&to=2020-01-01`);
    const indicators = page.getByRole("region", {
      name: "Indicadores del período",
    });
    await expect(
      indicators
        .getByRole("link", { name: /Visitas registradas/ })
        .locator("p.text-3xl"),
    ).toHaveText("0");
    await expect(
      indicators
        .getByRole("link", { name: /Rondas completadas/ })
        .locator("p.text-3xl"),
    ).toHaveText("—");
    await expect(
      indicators.getByText("0 de 0 puntos obligatorios de rondas iniciadas."),
    ).toBeVisible();
  });

  test("supervisor no puede consultar una garita ajena", async ({ page }) => {
    await login(page, "E2E-SUPERVISOR");
    await page.goto(`/admin?site=${siteId}&gate=${otherGateId}`);
    await expect(page.getByRole("alert")).toContainText(
      "garita no está disponible",
    );
    await expect(
      page.getByRole("region", { name: "Indicadores del período" }),
    ).toHaveCount(0);
    await page.goto(`/admin?site=${siteId}`);
    await expect(
      page.getByRole("region", { name: "Indicadores del período" }),
    ).toBeVisible();
  });
});
