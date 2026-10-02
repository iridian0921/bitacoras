/* Service worker: guarda la app en el teléfono para que abra sin señal.
   Al publicar una versión nueva, cambia VERSION para que los teléfonos la descarguen. */
const VERSION = "bitacoras-v3";
const ARCHIVOS = ["./", "index.html", "ups.html", "interruptores.html", "diagnostico.html", "comun.css", "comun.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // Primero la copia guardada (abre al instante y sin señal); en segundo plano se actualiza si hay red.
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(e.request, {ignoreSearch: true});
    const red = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return cached || (await red) || new Response("Sin conexión y sin copia guardada.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
