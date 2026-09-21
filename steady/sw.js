/**
 * Offline support for the rebuilt app.
 *
 * SCOPE SAFETY. This worker is only ever registered by a page served as a
 * directory index (a path ending in "/"), never by a named .html file. That
 * matters: two service workers cannot share a scope, so registering from
 * /abdquest/preview.html would claim /abdquest/ and take over AbdQuest.html,
 * the app actually in daily use. Registering from /abdquest/app/ claims only
 * /abdquest/app/ and cannot touch it. The guard lives in main.tsx.
 *
 * Strategy:
 *   - HTML: network first. A deploy must win immediately, because the whole app
 *     is one file and a stale copy is a stale everything. Falls back to cache
 *     when offline.
 *   - Fonts: cache first. They never change and they are the only thing loaded
 *     from another origin.
 *   - Everything else: passthrough. Nothing else is fetched at runtime except
 *     the health and prayer-time APIs, which must never be served stale.
 */

const VERSION = "v3-1";
const SHELL = `shell-${VERSION}`;
const FONTS = `fonts-${VERSION}`;

self.addEventListener("install", (event) => {
  // The page itself is cached on first fetch rather than pre-cached, since its
  // URL depends on which directory this was deployed into.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isFont(url) {
  return (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    /\.(woff2?|ttf|otf)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Never cache the APIs. Stale health or prayer data would be worse than none.
  if (url.hostname === "health.googleapis.com" || url.hostname === "api.aladhan.com") return;
  if (url.hostname === "oauth2.googleapis.com" || url.hostname === "accounts.google.com") return;

  if (isFont(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(FONTS)).put(req, res.clone());
          return res;
        } catch (e) {
          if (cached) return cached;
          throw e;
        }
      })(),
    );
    return;
  }

  const wantsHtml =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (!wantsHtml) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      } catch (e) {
        const cached = (await caches.match(req)) || (await caches.match("./"));
        if (cached) return cached;
        throw e;
      }
    })(),
  );
});
