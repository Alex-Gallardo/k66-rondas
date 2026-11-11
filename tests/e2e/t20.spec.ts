import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page.getByLabel("Contraseña", { exact: true }).fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("T-20 · configuración y auditoría", () => {
  test.skip(!process.env.E2E_PHASE2, "Requiere Supabase local y usuarios ficticios.");

  test("admin ve política GPS y eventos filtrados", async ({ page }) => {
    await login(page, "E2E-ADMIN");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
    await expect(page.getByRole("button", { name: /GPS para/ }).first()).toBeVisible();
    await page.goto("/admin/audit?action=site.&employee=E2E-ADMIN");
    await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
    await expect(page.getByText("Política GPS actualizada").first()).toBeVisible();
    await expect(page.getByText("GPS: activo → inactivo").first()).toBeVisible();
  });

  test("supervisor no accede a políticas ni a auditoría", async ({ page }) => {
    await login(page, "E2E-SUPERVISOR");
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/admin$/);
    const response = await page.request.patch("/api/admin/settings", {
      data: { site_id: "10000000-0000-4000-8000-000000000001", geo_enabled: false },
    });
    expect(response.status()).toBe(403);
  });
});
