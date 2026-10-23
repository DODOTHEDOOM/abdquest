// AbdQuest service worker: offline support.
//
// Strategy:
//   HTML / navigations -> network-first: a fresh deploy always wins while online,
//                         and the last good copy is served when offline.
//   everything else GET -> cache-first, refreshed in the background. Covers
//                         Google Fonts and the classic app's CDN React bundle.
//
// v2 change: each page is cached under its OWN url. v1 stored every HTML
// response under the single key "./AbdQuest.html", which was harmless while
// there was only one page. Once AbdQuest.html became the rebuilt app and the
// original moved to classic.html, opening the classic app would overwrite the
// cached AbdQuest.html, and the Home Screen icon could then open the old app
// while offline. Keying by url makes the two independent.
//
// Health, OAuth and prayer-time APIs are never cached. A stale reading is worse
// than no reading.
//
// Service workers cannot read or write localStorage, so nothing in here can
// touch saved data. The worst a bug here can do is serve an out-of-date page.

const CACHE = "abdquest-v3";
const CORE = [
  "./AbdQuest.html",
  "./classic.html",
  "./manifest.webmanifest",
  "./manifest.json",
];

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

const NEVER_CACHE = [
  "health.googleapis.com",
  "oauth2.googleapis.com",
  "accounts.google.com",
  "api.aladhan.com",
  "world.openfoodfacts.org",
];

/** Drop the query so ?code=... from an OAuth return does not fragment the cache. */
function pageKey(req) {
  const u = new URL(req.url);
  u.search = "";
  u.hash = "";
  return u.toString();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (NEVER_CACHE.includes(url.hostname)) return;

  if (isHTML(req)) {
    const key = pageKey(req);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(key)
            .then((r) => r || caches.match(new URL("./AbdQuest.html", self.registration.scope).toString())),
        ),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
