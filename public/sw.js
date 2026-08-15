// Minimal service worker: enough to satisfy Chrome's Android install
// criteria, plus basic offline caching of the app shell so it also works
// with no signal at the gym.
//
// Bump CACHE_VERSION whenever you want to force clients to pick up a new
// deployment's cached assets faster (not required for correctness — Vite
// hashes filenames so new builds get new URLs automatically).
const CACHE_VERSION = "v1";
const CACHE_NAME = `train-log-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("train-log-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigation/HTML so you always get the latest deploy
// when online; falls back to cache when offline. Cache-first for
// hashed build assets (JS/CSS/images) since their URLs change per build.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const isNavigation = request.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
    )
  );
});
