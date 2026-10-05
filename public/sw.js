// Rove service worker: keeps the closet usable offline.
//
// - Pages: network-first, falling back to the last good app shell.
// - Hashed build assets (/_next/static/): cache-first.
// - Closet data (GET /api/wardrobe, /api/outfits, /api/plans): network-first, falling back to the
//   last good response.
// - Garment images (/api/assets/…): cache-first.
//
// The site sits behind Cloudflare Access. Redirects (to the Access login) and opaque responses are
// passed straight through and never cached, so an expired session still reaches the login page.
// Writes, the backup download and the /hf/ model files (transformers.js caches those) are left alone.

const VERSION = "v1";
const SHELL_CACHE = `rove-shell-${VERSION}`;
const STATIC_CACHE = `rove-static-${VERSION}`;
const DATA_CACHE = `rove-data-${VERSION}`;
const IMAGE_CACHE = `rove-images-${VERSION}`;
const CACHES = [SHELL_CACHE, STATIC_CACHE, DATA_CACHE, IMAGE_CACHE];

const SHELL_URL = "/";
const SHELL_ASSETS = ["/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/apple-touch-icon.png"];
const DATA_PATHS = new Set(["/api/wardrobe", "/api/outfits", "/api/plans"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best effort: a signed-out install (Access redirect) must not fail the worker.
      await Promise.all(
        [SHELL_URL, ...SHELL_ASSETS].map(async (url) => {
          try {
            const response = await fetch(url, { credentials: "same-origin" });
            if (cacheable(response)) await cache.put(url, response);
          } catch {
            // Offline during install; the shell is cached on the next successful visit.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("rove-") && !CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith("/hf/") || path === "/api/export" || path === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_URL));
  } else if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 300));
  } else if (DATA_PATHS.has(path)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  } else if (path.startsWith("/api/assets/")) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 600));
  } else if (SHELL_ASSETS.includes(path)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
  }
});

/** Only plain, successful same-origin responses are stored. Redirects and opaque responses never are. */
function cacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(cacheKey)) || (await cache.match(request));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) {
    await cache.put(request, response.clone());
    trim(cache, maxEntries);
  }
  return response;
}

/** Drops the oldest entries so caches from old deploys and deleted pieces don't grow forever. */
async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(key);
}
