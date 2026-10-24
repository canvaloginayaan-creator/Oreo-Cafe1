// Network-first offline support so menu and configuration edits appear promptly.
const CACHE = "oreos-cafe-v3";
const SHELL = [
  "./", "index.html", "style.css", "script.js", "data.js", "cart.js",
  "firebase-config.js", "firebase-service.js", "pages.css", "product.html", "product.js",
  "checkout.html", "checkout.js", "auth.html", "auth.js", "info.html", "info.js",
  "manifest.webmanifest", "images/logo.png", "images/hero.jpg"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const url = new URL(event.request.url);
        const page = await caches.match(url.pathname.split("/").pop() || "index.html");
        return page || caches.match("index.html");
      }
      return Response.error();
    })
  );
});
