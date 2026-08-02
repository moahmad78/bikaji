/**
 * Bikaji QR Smart Ordering System - Enterprise Service Worker (v1)
 * Strategies:
 * - HTML Navigation: Network-First with Offline Fallback (/offline)
 * - Static Assets (Public Images, Custom Icons): Cache-First / Stale-While-Revalidate
 * - API Routes, Server Actions, & Next.js Dev HMR (_next/*): Network-Only (No Stale Chunks)
 */

const CACHE_NAME = "bikaji-pwa-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/offline",
  "/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/apple-touch-icon.png"
];

// 1. Install Event: Pre-cache core shell & offline fallback page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Pre-caching offline fallback assets");
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up stale caches & claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[ServiceWorker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Smart Routing
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET, API routes, and ALL Next.js internal /_next/ build & HMR chunks
  if (
    request.method !== "GET" ||
    !url.protocol.startsWith("http") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  // Strategy A: HTML Navigation (Pages) -> Network-First, Fallback to Cache, then Offline Page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.warn("[ServiceWorker] Network failed for navigation. Serving cached fallback.");
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          
          const offlineFallback = await caches.match(OFFLINE_URL);
          return offlineFallback || Response.error();
        })
    );
    return;
  }

  // Strategy B: Public Static Assets, Icons -> Stale-While-Revalidate
  const isPublicStaticAsset =
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);

  if (isPublicStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
          // Ignore network errors for static assets if cached
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// 4. Background Sync Hook
self.addEventListener("sync", (event) => {
  if (event.tag === "offline-order-sync") {
    console.log("[ServiceWorker] Background sync triggered: processing offline order queue...");
  }
});
