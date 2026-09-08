const CACHE = "coach-v1";
const SHELL = [
  "/",
  "/play",
  "/train",
  "/library",
  "/study",
  "/dashboard",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/") || url.host.includes("lichess")) return;
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
