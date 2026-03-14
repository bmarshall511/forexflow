/**
 * FXFlow Service Worker
 *
 * Minimal service worker for PWA installability.
 * Uses network-first strategy — trading data must always be live.
 * Caches the app shell for faster subsequent loads.
 */

const CACHE_NAME = "fxflow-v1"
const APP_SHELL = ["/offline.html"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  // Only handle navigation requests (HTML pages)
  if (event.request.mode !== "navigate") return

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match("/offline.html").then((response) => response || new Response("Offline")),
    ),
  )
})
