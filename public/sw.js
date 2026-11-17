const CACHE_NAME = "k66-public-shell-v1";
const PUBLIC_ASSETS = ["/offline.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("k66-public-shell-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;

  // Las páginas autenticadas siempre vienen de la red. La reserva es estática
  // y no contiene sesión, datos de rondas, QR, fotos ni respuestas de API.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match("/offline.html");
      return cached ?? Response.error();
    }),
  );
});
