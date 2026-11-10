import { expect, test } from "@playwright/test";

test.describe("Fase 2 · entorno local", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios de CI.",
  );

  test("sin sesión no se accede al panel ni a sus datos", async ({ page }) => {
    const response = await page.request.get("/api/admin/users");
    expect(response.status()).toBe(401);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("admin configura planta, QR, plantilla y cuenta personal", async ({
    page,
  }, testInfo) => {
    const suffix = testInfo.project.name.startsWith("mobile") ? "MOB" : "DESK";
    await page.goto("/login");
    await page.getByLabel("Código de empleado").fill("E2E-ADMIN");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("E2E-test-password-123");
    const loginCall = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/login-code"),
    );
    await page.getByRole("button", { name: "Ingresar" }).click();
    const loginResponse = await loginCall;
    expect(loginResponse.status(), await loginResponse.text()).toBe(200);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Todo listo para organizar/i }),
    ).toBeVisible();

    const post = async (path: string, data: unknown) => {
      const response = await page.request.post(path, { data });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    };

    const site = await post("/api/admin/catalog/sites", {
      code: `E2E-${suffix}`,
      name: `Sede ${suffix}`,
      timezone: "America/Guatemala",
    });
    const gate = await post("/api/admin/catalog/gates", {
      code: `G-${suffix}`,
      name: `Garita ${suffix}`,
      site_id: site.id,
    });
    const area = await post("/api/admin/catalog/areas", {
      code: `A-${suffix}`,
      name: `Area ${suffix}`,
      site_id: site.id,
      parent_id: null,
    });
    const point = await post("/api/admin/catalog/checkpoints", {
      code: `P-${suffix}`,
      name: `Punto ${suffix}`,
      area_id: area.id,
      description: "Acceso de prueba",
    });

    const initialQr = await (
      await page.request.get(`/api/admin/checkpoints/${point.id}/qr`)
    ).json();
    expect(initialQr.version).toBe(1);
    const pdf = await page.request.get(
      `/api/admin/checkpoints/${point.id}/qr?format=pdf`,
    );
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const rotated = await page.request.post(
      `/api/admin/checkpoints/${point.id}/qr`,
      { data: { reason: "Prueba de rotación E2E" } },
    );
    expect(rotated.ok()).toBeTruthy();
    const latestQr = await (
      await page.request.get(`/api/admin/checkpoints/${point.id}/qr`)
    ).json();
    expect(latestQr.version).toBe(2);
    expect(latestQr.url).not.toBe(initialQr.url);

    const template = await post("/api/admin/templates", {
      id: null,
      gate_id: gate.id,
      name: `Ronda ${suffix}`,
      is_default: true,
      points: [{ checkpoint_id: point.id, required: true }],
    });
    expect(template.id).toBeTruthy();
    const user = await post("/api/admin/users", {
      employee_code: `E2E-${suffix}-GUARD`,
      full_name: `Guardia ${suffix}`,
      role: "guard",
      gate_ids: [gate.id],
    });
    expect(user.temporary_password).toHaveLength(24);

    await page.goto("/admin/checkpoints");
    await page
      .getByRole("searchbox", { name: "Buscar por nombre" })
      .fill(`Punto ${suffix}`);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `Punto ${suffix}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "QR", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "QR", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "PDF para imprimir" }),
    ).toBeVisible();

    const guardedArchive = await page.request.patch(
      `/api/admin/catalog/checkpoints/${point.id}`,
      { data: { operation: "archive" } },
    );
    expect(guardedArchive.status(), await guardedArchive.text()).toBe(409);
    const archivedTemplate = await page.request.patch(
      `/api/admin/templates/${template.id}`,
      { data: { operation: "archive" } },
    );
    expect(archivedTemplate.status(), await archivedTemplate.text()).toBe(200);
    const archivedPoint = await page.request.patch(
      `/api/admin/catalog/checkpoints/${point.id}`,
      { data: { operation: "archive" } },
    );
    expect(archivedPoint.status(), await archivedPoint.text()).toBe(200);

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Código de empleado").fill(`E2E-${suffix}-GUARD`);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(user.temporary_password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/change-password$/);
    await page.getByLabel("Nueva contraseña").fill("NuevaClaveDePrueba-123");
    await page
      .getByLabel("Confirmar contraseña")
      .fill("NuevaClaveDePrueba-123");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/app$/);
    expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  });
});
