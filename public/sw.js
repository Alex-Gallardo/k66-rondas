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
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter(
                (name) =>
                  name.startsWith("k66-public-shell-") && name !== CACHE_NAME,
              )
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
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin
  )
    return;

  // Las páginas autenticadas siempre vienen de la red. La reserva es estática
  // y no contiene sesión, datos de rondas, QR, fotos ni respuestas de API.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match("/offline.html");
      return cached ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let notice;
  try {
    notice = event.data?.json();
  } catch {
    return;
  }
  if (
    !notice ||
    typeof notice.body !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(notice.id)
  )
    return;
  event.waitUntil(
    self.registration.showNotification("K66 Rondas", {
      body: notice.body.slice(0, 150),
      icon: "/icon-192.png",
      tag: notice.id,
      data: { noticeId: notice.id },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.noticeId;
  const path =
    typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)
      ? `/app/avisos?aviso=${id}`
      : "/app/avisos";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => client.url === target);
      if (existing) return existing.focus();
      const guard = windows.find((client) => {
        const url = new URL(client.url);
        return (
          url.origin === self.location.origin &&
          (url.pathname === "/app" || url.pathname === "/app/avisos")
        );
      });
      if (guard) {
        const navigated = await guard.navigate(target).catch(() => null);
        if (navigated) return navigated.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
