const APP_CACHE = "bonan-app-cache-v1";
const API_CACHE = "bonan-api-cache-v1";
const STATIC_CACHE = "bonan-static-cache-v1";
const CACHE_NAMES = [APP_CACHE, API_CACHE, STATIC_CACHE];

const PRECACHE_URLS = [
  "/dashboard/bonan",
  "/dashboard/bonan/daily",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (error) {
        console.error("Bonan SW precache skipped:", error);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((cacheName) => !CACHE_NAMES.includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw new Error("Network unavailable and no cached response.");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isBonanPage =
    request.mode === "navigate" &&
    (url.pathname.startsWith("/dashboard/bonan") || url.pathname.startsWith("/dashboard/management/bonan"));
  if (isBonanPage) {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/bonan/reports")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination);
  if (isStaticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
