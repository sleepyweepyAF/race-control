/* ============================================================
   RACE CONTROL — sw.js
   Service Worker (Fail-Safe 12)
   Provides true offline PWA support:
   ✔ Caches all app shell assets on install
   ✔ Serves cached assets instantly on load
   ✔ Network-first strategy for API calls
   ✔ Falls back to cache when network fails
   ============================================================ */

const CACHE_NAME = "race-control-v1"

/* App shell — all static assets to cache on install */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json"
]

/* API origins that should use network-first strategy */
const API_ORIGINS = [
  "api.openf1.org",
  "api.jolpi.ca"
]

/* ──────────────────────────────────────────────────────────
   INSTALL EVENT
   Pre-caches all app shell assets immediately.
   skipWaiting() activates the SW without waiting
   for old tabs to close.
   ────────────────────────────────────────────────────────── */

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )

})

/* ──────────────────────────────────────────────────────────
   ACTIVATE EVENT
   Deletes any old caches from previous SW versions.
   clients.claim() takes control of all open tabs
   immediately without needing a page reload.
   ────────────────────────────────────────────────────────── */

self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )

})

/* ──────────────────────────────────────────────────────────
   FETCH EVENT
   Two strategies depending on request type:

   API requests  → Network First
     Try network, cache response, fall back to cache.
     Ensures fresh data when online.
     Serves stale data when offline.

   App shell     → Cache First
     Serve from cache instantly.
     Update cache in background (stale-while-revalidate).
     Ensures instant load on every visit.
   ────────────────────────────────────────────────────────── */

self.addEventListener("fetch", event => {

  const url = new URL(event.request.url)

  const isAPIRequest = API_ORIGINS.some(origin => url.hostname.includes(origin))

  if (isAPIRequest) {

    /* NETWORK FIRST — for API calls */
    event.respondWith(networkFirst(event.request))

  } else {

    /* CACHE FIRST — for app shell assets */
    event.respondWith(cacheFirst(event.request))

  }

})

/* ──────────────────────────────────────────────────────────
   NETWORK FIRST STRATEGY
   1. Try network with 5 second timeout
   2. If successful, clone & update cache
   3. If network fails, serve from cache
   4. If nothing in cache, return offline response
   ────────────────────────────────────────────────────────── */

async function networkFirst(request) {

  try {

    const networkResponse = await fetchWithSWTimeout(request, 5000)

    /* Cache a clone of the successful response */
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, networkResponse.clone())

    return networkResponse

  } catch (err) {

    /* Network failed — try cache */
    const cached = await caches.match(request)

    if (cached) return cached

    /* Nothing cached — return a simple offline JSON response for APIs */
    return new Response(
      JSON.stringify({ error: "Offline — no cached data available." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" }
      }
    )

  }

}

/* ──────────────────────────────────────────────────────────
   CACHE FIRST STRATEGY
   1. Serve from cache immediately if available
   2. Fetch from network in background & update cache
   3. If nothing in cache, fetch from network directly
   ────────────────────────────────────────────────────────── */

async function cacheFirst(request) {

  const cached = await caches.match(request)

  if (cached) {

    /* Revalidate in background without blocking */
    fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response)
        })
      }
    }).catch(() => { /* Ignore background fetch errors */ })

    return cached

  }

  /* Nothing in cache — go to network */
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (err) {
    /* Complete failure — return minimal offline page */
    return new Response(
      "<h2 style='font-family:sans-serif;color:#e10600;text-align:center;margin-top:40px'>🏎 Race Control — Offline</h2><p style='text-align:center;color:#aaa'>Please reconnect to use the app.</p>",
      {
        status: 503,
        headers: { "Content-Type": "text/html" }
      }
    )
  }

}

/* ──────────────────────────────────────────────────────────
   SW FETCH TIMEOUT HELPER
   AbortController-based timeout for SW fetch calls.
   Separate from app.js fetchWithTimeout since SW
   runs in its own isolated scope.
   ────────────────────────────────────────────────────────── */

function fetchWithSWTimeout(request, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}
