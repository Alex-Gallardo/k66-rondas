import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(code.endsWith("ADMIN") ? /\/admin$/ : /\/app$/);
}

test("admin programa y el guardia asignado ve el escáner de su ronda", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y datos ficticios.",
  );
  const mobile = testInfo.project.name.startsWith("mobile");
  const code = mobile ? "E2E-NOTIFY-MOB" : "E2E-NOTIFY-DESK";
  const local = new Date(Date.now() + 5 * 60000 - 6 * 3600000);
  const iso = local.toISOString();
  const day = iso.slice(0, 10);
  const weekday = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
    local.getUTCDay()
  ];

  await login(page, "E2E-ADMIN");
  await page.goto("/admin/rounds/schedule");
  await page
    .getByLabel("Garita", { exact: true })
    .selectOption("20000000-0000-4000-8000-000000000001");
  await page
    .getByLabel("Recorrido", { exact: true })
    .selectOption("50000000-0000-4000-8000-000000000001");
  await page.getByLabel("Guardia responsable").selectOption({
    label: mobile
      ? "Guardia Avisos Móvil · E2E-NOTIFY-MOB"
      : "Guardia Avisos Escritorio · E2E-NOTIFY-DESK",
  });
  await page.getByLabel("Hora local").fill(iso.slice(11, 16));
  await page.getByLabel("Vigente desde").fill(day);
  await page.getByLabel("Vigente hasta (opcional)").fill(day);
  await page.getByRole("checkbox", { name: weekday, exact: true }).check();
  await expect(
    page.getByText("Próximas fechas locales", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Guardar regla" }).click();
  await expect(page.getByText("Programación actualizada.")).toBeVisible();
  const context = await browser.newContext();
  try {
    const guard = await context.newPage();
    await login(guard, code);
    await expect(
      guard.getByRole("link", { name: "Escanear QR", exact: true }),
    ).toHaveAttribute("href", /occurrence=/);
    await guard.getByRole("link", { name: "Avisos", exact: true }).click();
    await expect(
      guard.getByRole("heading", { name: "Rondas programadas" }),
    ).toBeVisible();
    await expect(
      guard.getByRole("link", { name: "Escanear QR de esta ronda" }),
    ).toBeVisible();
    await expect(
      guard.getByRole("heading", {
        name: "Notificaciones en este dispositivo",
      }),
    ).toBeVisible();
    const status = await guard.request.get("/api/guard/notifications/device");
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({ active: false, publicKey: null });
    await expect(
      guard.getByRole("button", { name: "Activar notificaciones" }),
    ).toHaveCount(0);
    const forbidden = await guard.request.post("/api/admin/patrol-schedules", {
      data: {},
    });
    expect(forbidden.status()).toBe(403);
  } finally {
    await context.close();
  }
});
