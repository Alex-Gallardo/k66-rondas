import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const gateId = "20000000-0000-4000-8000-000000000001";
const templateId = "50000000-0000-4000-8000-000000000001";
const firstQr = "11111111111111111111111111111111";
const secondQr = "33333333333333333333333333333333";

test.describe("T-12 · registro transaccional de visitas", () => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios de CI.",
  );

  test("sin sesión no registra visitas", async ({ request }) => {
    const response = await request.post("/api/visits", {
      data: { qr_code: firstQr, idempotency_key: randomUUID() },
    });
    expect(response.status()).toBe(401);
  });

  test("dos envíos simultáneos no duplican la visita ni el punto", async ({
    page,
  }, testInfo) => {
    const code = testInfo.project.name.startsWith("mobile")
      ? "E2E-T12-MOB"
      : "E2E-T12-DESK";
    await page.goto("/login");
    await page.getByLabel("Código de empleado").fill(code);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("E2E-test-password-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/app$/);

    const noPatrol = await page.request.post("/api/visits", {
      data: { qr_code: firstQr, idempotency_key: randomUUID() },
    });
    expect(noPatrol.status(), await noPatrol.text()).toBe(409);
    const shift = await page.request.post("/api/shifts", {
      data: { gate_id: gateId },
    });
    expect(shift.status(), await shift.text()).toBe(201);
    const shiftId = (await shift.json()).id;
    const patrol = await page.request.post("/api/patrols", {
      data: { template_id: templateId },
    });
    expect(patrol.status(), await patrol.text()).toBe(201);
    const patrolId = (await patrol.json()).id;

    const invalidGeo = await page.request.post("/api/visits", {
      data: {
        qr_code: firstQr,
        idempotency_key: randomUUID(),
        geo: { status: "captured", latitude: 91, longitude: -90 },
      },
    });
    expect(invalidGeo.status(), await invalidGeo.text()).toBe(400);
    const unexpected = await page.request.post("/api/visits", {
      data: {
        qr_code: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        idempotency_key: randomUUID(),
      },
    });
    expect(unexpected.status(), await unexpected.text()).toBe(409);

    const key = randomUUID();
    const first = await Promise.all(
      [0, 1].map(() =>
        page.request.post("/api/visits", {
          data: {
            qr_code: firstQr,
            idempotency_key: key,
            geo: { status: "denied" },
          },
        }),
      ),
    );
    const outcomes = await Promise.all(
      first.map(async (response) => ({
        status: response.status(),
        body: await response.json(),
      })),
    );
    expect(outcomes.map((item) => item.status).sort()).toEqual([200, 201]);
    expect(outcomes.map((item) => item.body.outcome).sort()).toEqual([
      "idempotent",
      "recorded",
    ]);
    expect(new Set(outcomes.map((item) => item.body.visit_id)).size).toBe(1);
    expect(outcomes[0].body.progress).toMatchObject({ visited: 1, total: 2 });
    expect(outcomes[0].body).not.toHaveProperty("qr_code");
    expect(Date.parse(outcomes[0].body.recorded_at)).toBeGreaterThan(
      Date.now() - 60_000,
    );

    const conflict = await page.request.post("/api/visits", {
      data: { qr_code: secondQr, idempotency_key: key },
    });
    expect(conflict.status(), await conflict.text()).toBe(409);
    expect((await conflict.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");

    const second = await Promise.all(
      [0, 1].map(() =>
        page.request.post("/api/visits", {
          data: { qr_code: secondQr, idempotency_key: randomUUID() },
        }),
      ),
    );
    const secondOutcomes = await Promise.all(
      second.map(async (response) => ({
        status: response.status(),
        body: await response.json(),
      })),
    );
    expect(secondOutcomes.map((item) => item.status).sort()).toEqual([
      200, 201,
    ]);
    expect(secondOutcomes.map((item) => item.body.outcome).sort()).toEqual([
      "already_scanned",
      "recorded",
    ]);
    expect(new Set(secondOutcomes.map((item) => item.body.visit_id)).size).toBe(
      1,
    );
    expect(secondOutcomes[0].body.progress).toMatchObject({
      visited: 2,
      total: 2,
    });
    expect(secondOutcomes[0].body.patrol_status).toBe("completed");

    const current = await (
      await page.request.get("/api/shifts/current")
    ).json();
    expect(current.shift.id).toBe(shiftId);
    expect(current.patrol).toBeNull();
    const closed = await page.request.post(`/api/shifts/${shiftId}/close`, {
      data: {},
    });
    expect(closed.status(), await closed.text()).toBe(200);
    expect(patrolId).toBe(outcomes[0].body.patrol_id);
  });
});
