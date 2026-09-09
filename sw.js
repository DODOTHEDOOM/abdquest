// AbdQuest service worker — offline support.
//
// Strategy:
//   HTML / navigations -> network-first: a fresh deploy always wins while online,
//                         and the last good copy is served when offline.
//   everything else GET -> cache-first, refreshed in the background. This covers
//                         the CDN React bundle and Google Fonts so the app can
//                         boot with no connection at all.
//
// CACHE is versioned; activate() deletes every other cache, so a bumped version
// wipes the old one. There is no way for a stale HTML to get "stuck": the HTML
// is only ever read from cache when the network genuinely fails.

const CACHE = "abdquest-v1";
const CORE = ["./AbdQuest.html", "./manifest.json"];
const HTML_KEY = "./AbdQuest.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

function isHTML(req) {
  if (req.mode === "navigate") return true;
  return req.method === "GET" && (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (isHTML(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(HTML_KEY, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(HTML_KEY))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
