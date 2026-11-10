import { expect, test } from "@playwright/test";

test.describe("T-11 · turno y ronda del guardia", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios de CI.",
  );

  test("sin sesión no se abren turnos", async ({ request }) => {
    const response = await request.post("/api/shifts", {
      data: { gate_id: "20000000-0000-4000-8000-000000000001" },
    });
    expect(response.status()).toBe(401);
  });

  test("abre turno, inicia ronda, exige motivo y cierra ambas", async ({
    page,
  }, testInfo) => {
    const code = testInfo.project.name.startsWith("mobile")
      ? "E2E-T11-MOB"
      : "E2E-T11-DESK";
    await page.goto("/login");
    await page.getByLabel("Código de empleado").fill(code);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("E2E-test-password-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "¿Desde qué garita trabajas?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Iniciar turno" }).click();
    await expect(
      page.getByRole("heading", { name: "Comienza una ronda" }),
    ).toBeVisible();
    const current = await (
      await page.request.get("/api/shifts/current")
    ).json();
    expect(current.shift.gate_name_snapshot).toBe("Garita Central");
    const duplicate = await page.request.post("/api/shifts", {
      data: { gate_id: current.shift.gate_id },
    });
    expect(duplicate.status(), await duplicate.text()).toBe(409);

    await page.getByRole("button", { name: "Comenzar ronda" }).click();
    await expect(
      page.getByRole("heading", { name: "Tu recorrido" }),
    ).toBeVisible();
    await expect(page.getByText("0/2")).toBeVisible();
    const active = await (await page.request.get("/api/shifts/current")).json();
    expect(active.patrol.points).toHaveLength(2);
    const earlyShiftClose = await page.request.post(
      `/api/shifts/${active.shift.id}/close`,
      { data: {} },
    );
    expect(earlyShiftClose.status(), await earlyShiftClose.text()).toBe(409);
    const missingReason = await page.request.post(
      `/api/patrols/${active.patrol.id}/close`,
      { data: {} },
    );
    expect(missingReason.status(), await missingReason.text()).toBe(400);

    await page.getByRole("button", { name: "Cerrar ronda" }).click();
    await page
      .getByLabel("Motivo del cierre")
      .fill("Área cerrada por mantenimiento");
    await page.getByRole("button", { name: "Confirmar cierre" }).click();
    await expect(
      page.getByRole("heading", { name: "Comienza una ronda" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar turno" }).click();
    await page.getByRole("button", { name: "Confirmar cierre" }).click();
    await expect(
      page.getByRole("heading", { name: "¿Desde qué garita trabajas?" }),
    ).toBeVisible();
    const closed = await (await page.request.get("/api/shifts/current")).json();
    expect(closed.shift).toBeNull();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
});
