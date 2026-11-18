const base = new URL(process.argv[2] ?? "https://k66-rondas.vercel.app");
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (base.protocol !== "https:" && !(local && base.protocol === "http:"))
  throw new Error("Usa HTTPS o HTTP local.");
if (base.username || base.password || base.search || base.hash)
  throw new Error("La URL base no debe incluir credenciales ni parámetros.");

const checks = [
  {
    path: "/login",
    status: 200,
    contentType: "text/html",
    verify: (body) => body.includes("K66 Rondas"),
  },
  {
    path: "/install",
    status: 200,
    contentType: "text/html",
    verify: (body) => body.includes("Añadir a inicio"),
  },
  {
    path: "/manifest.webmanifest",
    status: 200,
    contentType: "application/manifest+json",
    verify: (body) => JSON.parse(body).name === "K66 Rondas",
  },
  {
    path: "/api/health",
    status: 200,
    contentType: "application/json",
    verify: (body) => JSON.parse(body).status === "ok",
  },
  {
    path: "/api/admin/users",
    status: 401,
    contentType: "application/json",
    verify: () => true,
  },
];

const results = [];
for (const check of checks) {
  try {
    const start = performance.now();
    const response = await fetch(new URL(check.path, base), {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    const passed =
      response.status === check.status &&
      response.headers.get("content-type")?.includes(check.contentType) &&
      check.verify(body);
    results.push({
      path: check.path,
      status: response.status,
      duration_ms: Math.round(performance.now() - start),
      passed: Boolean(passed),
    });
  } catch (error) {
    results.push({
      path: check.path,
      passed: false,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

console.log(
  JSON.stringify(
    { base: base.origin, checked_at: new Date().toISOString(), results },
    null,
    2,
  ),
);
if (results.some((item) => !item.passed)) process.exitCode = 1;
