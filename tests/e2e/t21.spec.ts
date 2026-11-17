import { expect, test } from "@playwright/test";

test("T-21 · manifiesto, iconos e instrucciones de instalación", async ({
  page,
  isMobile,
}) => {
  await page.goto("/install");
  await expect(
    page.getByRole("heading", { name: "Añadir a inicio" }),
  ).toBeVisible();
  if (isMobile)
    await expect(
      page.getByRole("heading", { name: "En Android" }),
    ).toBeVisible();
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("K66 Rondas");
  expect(manifest.start_url).toBe("/app");
  expect(manifest.display).toBe("standalone");
  expect(
    manifest.icons.some((icon: { purpose?: string }) =>
      icon.purpose?.includes("maskable"),
    ),
  ).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const worker = await page.request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["cache-control"]).toContain("no-store");
});

test("T-21 · instrucciones para añadir a inicio en iPhone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/install");
    await expect(
      page.getByRole("heading", { name: "En iPhone o iPad" }),
    ).toBeVisible();
    await expect(page.getByText("Agregar a pantalla de inicio")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("T-21 · navegación sin red muestra reserva pública y no guarda datos privados", async ({
  page,
  context,
}) => {
  await page.goto("/install");
  await page.waitForFunction(
    () =>
      "serviceWorker" in navigator &&
      navigator.serviceWorker.controller !== null,
  );
  const cachedPaths = await page.evaluate(async () => {
    const names = await caches.keys();
    const paths: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys())
        paths.push(new URL(request.url).pathname);
    }
    return paths.sort();
  });
  expect(cachedPaths).toEqual([
    "/icon-192.png",
    "/icon-512.png",
    "/offline.html",
  ]);

  await context.setOffline(true);
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Sin conexión" }),
  ).toBeVisible();
  await expect(
    page.getByText("No se guardó ningún QR sin confirmación.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("T-21 · el guardia no puede iniciar escaneo sin red", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.E2E_PHASE2,
    "Requiere Supabase local y usuarios ficticios.",
  );
  await page.goto("/login");
  await page.getByLabel("Código de empleado").fill("E2E-GUARD");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await context.setOffline(true);
  await expect(
    page.getByText("Sin conexión. Los QR no se guardarán"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Escanear QR · sin conexión/ }),
  ).toBeDisabled();
});
