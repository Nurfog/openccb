const SW_VERSION = "openccb-experience-v1";
const STATIC_CACHE = `${SW_VERSION}-static`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const API_CACHE = `${SW_VERSION}-api`;

const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/pwa-icon-192.svg",
  "/pwa-icon-512.svg",
  "/next.svg",
  "/window.svg",
  "/globe.svg",
  "/grid.svg",
  "/file.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(SW_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(async () => {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
        await self.clients.claim();
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isApiRequest = (url) => url.pathname.startsWith("/lms-api") || url.pathname.startsWith("/cms-api");
const isStaticRequest = (request) => ["style", "script", "image", "font"].includes(request.destination);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          const preloadClone = preloadResponse.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, preloadClone));
          return preloadResponse;
        }

        return fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        });
      })()
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ message: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  if (isStaticRequest(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || !response.ok) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});