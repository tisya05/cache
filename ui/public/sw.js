// Minimal service worker: exists mainly to satisfy PWA installability
// criteria (a fetch handler is required) without adding caching risk right
// before a live demo -- everything just passes through to the network.
// A real offline strategy is future work, not needed for this build.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
