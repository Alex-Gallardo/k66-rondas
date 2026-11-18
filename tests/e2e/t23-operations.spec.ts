import { expect, test } from "@playwright/test";

test("T-23 · salud pública verifica la base sin revelar datos", async ({
  request,
}) => {
  test.skip(!process.env.E2E_PHASE2, "Requiere Supabase local de CI.");
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
