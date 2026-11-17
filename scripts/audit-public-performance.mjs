import { chromium, devices } from "@playwright/test";

const base = new URL(process.argv[2] ?? "https://k66-rondas.vercel.app");
if (!["http:", "https:"].includes(base.protocol))
  throw new Error("URL HTTP(S) requerida.");
const runs = Number(process.argv[3] ?? 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 10)
  throw new Error("Usa entre 1 y 10 repeticiones.");

const browser = await chromium.launch();
const results = [];
try {
  for (const [device, options] of [
    ["desktop", devices["Desktop Chrome"]],
    ["mobile", devices["Pixel 7"]],
  ]) {
    for (const path of ["/login", "/install"]) {
      for (let run = 1; run <= runs; run++) {
        const context = await browser.newContext({
          ...options,
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__k66Vitals = { lcp: null, cls: 0 };
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              window.__k66Vitals.lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__k66Vitals.cls += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        });
        const response = await page.goto(new URL(path, base).toString(), {
          waitUntil: "load",
          timeout: 30_000,
        });
        await page.waitForTimeout(1200);
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          return {
            lcp_ms:
              window.__k66Vitals.lcp === null
                ? null
                : Math.round(window.__k66Vitals.lcp),
            cls: Number(window.__k66Vitals.cls.toFixed(3)),
            ttfb_ms: Math.round(navigation.responseStart),
            load_ms: Math.round(navigation.loadEventEnd),
            transfer_bytes: navigation.transferSize,
          };
        });
        results.push({
          device,
          path,
          run,
          status: response?.status() ?? null,
          ...metrics,
        });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      base: base.origin,
      measured_at: new Date().toISOString(),
      note: "Muestra sintética pequeña; no equivale a Core Web Vitals de campo ni mide INP.",
      results,
    },
    null,
    2,
  ),
);
