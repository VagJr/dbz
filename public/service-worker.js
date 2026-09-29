/* Only the install icons are cached. The live game and account traffic stay on the network. */
const ICON_CACHE = "universe-z-pwa-icons-v1";
const ICONS = ["/assets/pwa/icon-192.png", "/assets/pwa/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ICON_CACHE).then((cache) => cache.addAll(ICONS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("universe-z-pwa-icons-") && key !== ICON_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !ICONS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
