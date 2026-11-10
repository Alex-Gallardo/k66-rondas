import { expect, test } from "@playwright/test";

test("el inicio lleva directamente al acceso", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /Tu ronda empieza aquí/i }),
  ).toBeVisible();
});

test("el styleguide muestra confirmaciones y no desborda el móvil", async ({
  page,
}) => {
  await page.goto("/styleguide");
  await page.getByRole("button", { name: /Ver confirmación/i }).click();
  await expect(
    page.getByRole("dialog").getByText("Punto registrado"),
  ).toBeVisible();
  await page.getByRole("button", { name: /Continuar ronda/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
