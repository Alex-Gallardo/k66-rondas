import { expect, test } from "@playwright/test";
import QRCode from "qrcode";

const qr = "11111111111111111111111111111111";
const nextQr = "ABCDEF0123456789";

test("login, QR directo, nota e historial propios", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_PHASE2, "Requiere Supabase local.");
  const code = testInfo.project.name.startsWith("mobile")
    ? "E2E-DEMO-MOB"
    : "E2E-DEMO-DESK";
  const image = await QRCode.toDataURL(nextQr, {
    margin: 4,
    width: 420,
  });
  await page.addInitScript((qrImage) => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints?.video) return original(constraints);
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "white";
      context.fillRect(0, 0, 640, 640);
      const qr = new Image();
      qr.src = qrImage;
      await qr.decode();
      context.drawImage(qr, 110, 110, 420, 420);
      return canvas.captureStream(20);
    };
  }, image);
  await page.context().grantPermissions(["camera"]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Código de empleado").fill(code);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("E2E-test-password-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: "Escanear QR" })).toBeVisible();

  await page.goto(`/scan/${qr}`);
  await expect(
    page.getByRole("alertdialog", { name: "Activa la ubicación GPS" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alertdialog").getByText("Este punto no se guardó.", {
      exact: false,
    }),
  ).toBeVisible();
  const beforeGps = await (
    await page.request.get("/api/shifts/current")
  ).json();
  expect(
    beforeGps.patrol.points.every(
      (point: { visited: boolean }) => !point.visited,
    ),
  ).toBe(true);
  await page.context().setGeolocation({
    latitude: 14.6349,
    longitude: -90.5069,
  });
  await page.context().grantPermissions(["camera", "geolocation"]);
  await page.getByRole("button", { name: "Reintentar GPS" }).click();
  await expect(
    page.getByText("Punto registrado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 de 1 punto registrado")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("garita-confirmacion.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Añadir observación" }).click();
  await page
    .getByRole("textbox", { name: "Observación" })
    .fill("Revisión de demostración OK");
  await page.getByRole("button", { name: "Guardar observación" }).click();
  await expect(page.getByText("Observación guardada.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "evidencia.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByText("Fotografía guardada.")).toBeVisible();
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page.getByText("Último punto registrado")).toBeVisible();
  await page.getByRole("link", { name: "Ver mi historial" }).click();
  await page.screenshot({
    path: testInfo.outputPath("garita-historial.png"),
    animations: "disabled",
  });
  await page.locator("summary").filter({ hasText: "Observación" }).click();
  await expect(page.getByText("Revisión de demostración OK")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver fotografía" }),
  ).toBeVisible();
  await page.goto("/app");
  await page.getByRole("link", { name: "Escanear QR" }).click();
  await expect(page.getByText("Ronda completada")).toBeVisible({
    timeout: 30_000,
  });
});
