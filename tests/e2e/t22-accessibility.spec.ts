import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((item) => ({
      rule: item.id,
      impact: item.impact,
      elements: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(code === "E2E-GUARD" ? /\/app$/ : /\/admin$/);
}

test("T-22 · login e instalación cumplen reglas WCAG automáticas", async ({
  page,
}) => {
  await page.goto("/login");
  await expectAccessible(page);
  await page.goto("/install");
  await expectAccessible(page);
});

test("T-22 · guardia y panel admin cumplen reglas WCAG automáticas", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios.",
  );
  await login(page, "E2E-GUARD");
  await expectAccessible(page);
  await page.context().clearCookies();
  await login(page, "E2E-ADMIN");
  await expectAccessible(page);
  await page.goto("/admin/visits");
  await expectAccessible(page);
});

test("T-22 · teclado y anchura móvil permiten operar el acceso", async ({
  page,
}) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => document.activeElement?.tagName);
  expect(["A", "INPUT", "BUTTON"]).toContain(active);
  await page.getByLabel("Código de empleado").focus();
  await expect(page.getByLabel("Código de empleado")).toBeFocused();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
