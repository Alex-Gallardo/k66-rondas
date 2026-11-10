import { expect, test } from "@playwright/test";

test("el inicio abre el sistema visual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cada ronda, clara desde el primer punto/i })).toBeVisible();
  await page.getByRole("link", { name: /Explorar el sistema visual/i }).click();
  await expect(page).toHaveURL(/\/styleguide$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Rondas fáciles de registrar/i })).toBeVisible();
});

test("el styleguide muestra confirmaciones y no desborda el móvil", async ({ page }) => {
  await page.goto("/styleguide");
  await page.getByRole("button", { name: /Ver confirmación/i }).click();
  await expect(page.getByRole("dialog").getByText("Punto registrado")).toBeVisible();
  await page.getByRole("button", { name: /Continuar ronda/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
