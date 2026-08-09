const CACHE = "tcc-shell-v6";
const SHELL = ["./", "./index.html", "./tokens.css", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Page itself is network-first so edits show up right away; everything
   else (fonts, icons, css) is cache-first for instant offline paint. */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Stay out of the way of the API and of any write. Returning without
     respondWith hands the request back to the browser untouched, so a
     stale pins/list response can never come out of the cache. */
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
