import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";

const siteId = "10000000-0000-4000-8000-000000000001";
const qr = "11111111111111111111111111111111";

async function login(page: Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(code === "E2E-GUARD" ? /\/app$/ : /\/admin$/);
}

test.describe("T-22 · límites de acceso", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios.",
  );

  test("sin sesión las rutas de operación y administración rechazan datos", async ({
    request,
  }) => {
    for (const path of [
      "/api/admin/users",
      "/api/admin/catalog/sites",
      "/api/admin/visits/export",
      "/api/shifts/current",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
    const visit = await request.post("/api/visits", {
      data: { qr_code: qr, idempotency_key: randomUUID() },
    });
    expect(visit.status()).toBe(401);
    expect(visit.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(visit.headers()["server-timing"]).toMatch(/^visit;dur=\d+$/);
    expect(visit.headers()["cache-control"]).toContain("no-store");
  });

  test("guardia, supervisor y administrador conservan sus roles", async ({
    page,
  }) => {
    await login(page, "E2E-GUARD");
    expect((await page.request.get("/api/admin/users")).status()).toBe(403);
    expect((await page.request.get("/api/admin/visits/export")).status()).toBe(
      403,
    );
    await page.context().clearCookies();

    await login(page, "E2E-SUPERVISOR");
    expect((await page.request.get("/api/admin/users")).status()).toBe(403);
    expect(
      (
        await page.request.patch("/api/admin/settings", {
          data: { site_id: siteId, geo_enabled: false },
        })
      ).status(),
    ).toBe(403);
    await page.context().clearCookies();

    await login(page, "E2E-ADMIN");
    expect(
      (
        await page.request.post("/api/visits", {
          data: { qr_code: qr, idempotency_key: randomUUID() },
        })
      ).status(),
    ).toBe(403);
    await page.context().clearCookies();
    expect((await page.request.get("/api/admin/users")).status()).toBe(401);
  });

  test("mutaciones rechazan origen ajeno, formato incorrecto y cuerpos inválidos", async ({
    page,
  }) => {
    await login(page, "E2E-GUARD");
    const body = { qr_code: qr, idempotency_key: randomUUID() };
    const foreign = await page.request.post("/api/visits", {
      data: body,
      headers: { Origin: "https://otra-planta.example" },
    });
    expect(foreign.status()).toBe(403);
    expect((await foreign.json()).error.code).toBe("INVALID_ORIGIN");
    const wrongType = await page.request.post("/api/visits", {
      data: JSON.stringify(body),
      headers: { "Content-Type": "text/plain" },
    });
    expect(wrongType.status()).toBe(415);
    const invalid = await page.request.post("/api/visits", {
      data: { qr_code: "mal-formato", idempotency_key: randomUUID() },
    });
    expect(invalid.status()).toBe(400);
  });

  test("la clave pública no puede consultar tablas operativas directamente", async ({
    request,
  }) => {
    loadEnvConfig(process.cwd());
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
    for (const table of [
      "profiles",
      "visits",
      "audit_events",
      "site_settings",
    ]) {
      const response = await request.get(
        `${url}/rest/v1/${table}?select=*&limit=1`,
        {
          headers: { apikey: key! },
        },
      );
      expect([401, 403], `${table}: ${await response.text()}`).toContain(
        response.status(),
      );
    }
  });
});
