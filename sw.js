/*
 * Learning Buddy service worker — makes the app work offline.
 *
 * Strategy: "network first, fall back to cache."
 *   - Online  → always fetch the latest files (so updates show immediately),
 *               and refresh the saved copy in the background.
 *   - Offline → serve the last saved copy so the app still works.
 *
 * This avoids the "stale cached version" trap of a cache-first worker.
 * Bump CACHE_VERSION whenever you want to guarantee a clean refresh.
 */

const CACHE_VERSION = "learning-buddy-v4";

// Relative paths so it works whether hosted at the domain root or in a /subfolder.
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./math-data.js",
  "./app.js",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: pre-cache everything, and take over right away.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches, then control existing pages immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: try the network first; if that fails (offline), use the cached copy.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        // Refresh the cached copy with the fresh one.
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request)) // offline — serve last saved copy
  );
});
