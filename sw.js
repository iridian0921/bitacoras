/* Service worker: guarda la app en el teléfono para que abra sin señal.
   Al publicar una versión nueva, cambia VERSION para que los teléfonos la descarguen. */
const VERSION = "bitacoras-v12";
/* Sin estos la app no abre: si alguno no se puede bajar, la versión nueva no se instala y se queda la anterior. */
const INDISPENSABLES = ["./", "index.html", "ups.html", "interruptores.html", "comun.css", "comun.js"];
/* Estos se intentan, pero si fallan la versión se instala igual y se completan después al usarlos. */
const OPCIONALES = ["diagnostico.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const espera = ms => new Promise(r => setTimeout(r, ms));

/* Baja un archivo con reintentos. cache:"reload" evita la caché HTTP del navegador (GitHub Pages la guarda
   10 min): sin esto, una versión nueva podía guardarse con los archivos viejos. */
async function bajar(c, u, intentos = 4){
  if (await c.match(u)) return true;          // ya bajó en un intento anterior de esta misma versión
  for (let i = 0; i < intentos; i++){
    try{
      const r = await fetch(new Request(u, {cache:"reload"}));
      if (r.ok){ await c.put(u, r); return true; }
    }catch{}
    if (i < intentos - 1) await espera(1500 * (i + 1));
  }
  return false;
}

/* Uno por uno y con reintentos: en redes que se cortan (datos móviles inestables), bajar todo a la vez con
   addAll fallaba casi siempre y la app nunca terminaba de instalarse. Lo que sí bajó se conserva en la caché de
   esta versión, así que el siguiente intento (al volver a abrir la app) solo baja lo que falta. */
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    for (const u of INDISPENSABLES) if (!(await bajar(c, u))) throw new Error("No se pudo bajar " + u);
    for (const u of OPCIONALES) await bajar(c, u, 2);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/reparar.html")) return;   // siempre del servidor: es la salida cuando la copia se atora
  // Primero la copia guardada (abre al instante y sin señal); en segundo plano se actualiza si hay red.
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(e.request, {ignoreSearch: true});
    const traer = () => fetch(e.request.url, {cache:"no-cache"}).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; });
    const red = traer().catch(() => null);
    if (cached) return cached;
    // sin copia: si la red se cortó, un segundo intento antes de rendirse
    return (await red) || (await espera(1500).then(traer).catch(() => null)) ||
      new Response("Sin conexión y sin copia guardada. Revisa la señal y vuelve a cargar.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
