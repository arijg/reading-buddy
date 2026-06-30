/*
 * Reading Buddy service worker — makes the app work offline.
 *
 * Strategy: "cache first." On install we cache every file. After that the app
 * loads straight from the cache (instant, works with no internet). When you
 * change the app, bump CACHE_VERSION so phones fetch the new files.
 */

const CACHE_VERSION = "reading-buddy-v1";

// Relative paths so it works whether hosted at the domain root or in a /subfolder.
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: pre-cache everything.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network (and cache new GETs).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => cached); // offline and not cached — nothing we can do
    })
  );
});
