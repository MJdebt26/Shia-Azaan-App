/*
 * Awqāt service worker.
 *
 * Two jobs:
 *   1. Offline. The timetable is computed on-device from astronomy, so once the
 *      shell and the chunks are cached the app is fully usable with no network.
 *   2. Push. This is what makes a prayer alert arrive when the app is closed.
 *      v1 tried to do this with the Notification Triggers API, which Google
 *      never shipped, so nothing ever fired. Real Web Push replaces it.
 *
 * Plain JS on purpose: it is served as a static file from /public and is not
 * part of the bundle, so it must never import application code. The push
 * payload shape is the contract with lib/push/payload.ts.
 */

/* eslint-disable no-restricted-globals */

// Bumped whenever shipped assets change in a way a stale cache would hide.
// The activate handler deletes every cache not on this version, and the worker
// claims open clients — so an installed Home Screen PWA, which iOS will happily
// keep booting from its old snapshot, is forced onto the new bundle instead of
// serving last week's code forever.
const VERSION = "v3";
const SHELL_CACHE = `awqat-shell-${VERSION}`;
const RUNTIME_CACHE = `awqat-runtime-${VERSION}`;
const AUDIO_CACHE = `awqat-audio-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE, AUDIO_CACHE];

/** Precached on install so the very first offline load works. */
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/icon-192.png";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 (an icon that moved) cannot fail the whole
      // install and leave the user with no service worker at all.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      // Take over immediately: a stale worker that still believes in
      // TimestampTrigger is the exact thing we are replacing.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("awqat-") && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Fetch strategies
// ---------------------------------------------------------------------------

/** Network-first with a cached shell fallback — never serve a stale app. */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
    }
    return response;
  } catch (error) {
    const cache = await caches.open(SHELL_CACHE);
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/", { ignoreSearch: true }));
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Awqāt</title>" +
        "<body style=\"font:16px/1.5 system-ui;padding:2rem\">" +
        "<h1>Offline</h1><p>Awqāt has not finished caching yet. " +
        "Reconnect once and it will work offline from then on.</p>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}

/** Cache-first — adhan files are large, immutable and needed at 4am offline. */
async function handleAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // 206 Partial Content (a seeking <audio> element) must not be cached: it
  // would be replayed as a truncated file forever.
  if (response && response.status === 200) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

/** Stale-while-revalidate — instant paint, refreshed in the background. */
async function handleAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // API responses are per-user and time-sensitive (the VAPID key, subscription
  // state). Caching them would be actively harmful, so hand them to the network
  // untouched.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/audio/") && url.pathname.endsWith(".mp3")) {
    event.respondWith(handleAudio(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Parse the dispatcher's payload, tolerating anything unexpected.
 *
 * A push event that throws makes the browser show its own "This site has been
 * updated in the background" notification, so every failure path here still
 * produces a real prayer notification.
 */
function readPayload(event) {
  const fallback = {
    title: "Awqāt",
    body: "It is time to pray.",
    tag: "awqat-prayer",
    url: "/",
    requireInteraction: false,
  };
  if (!event.data) return fallback;
  try {
    const data = event.data.json();
    if (!data || typeof data !== "object") return fallback;
    return {
      title: typeof data.title === "string" && data.title ? data.title : fallback.title,
      body: typeof data.body === "string" && data.body ? data.body : fallback.body,
      tag: typeof data.tag === "string" && data.tag ? data.tag : fallback.tag,
      url: typeof data.url === "string" && data.url ? data.url : "/",
      requireInteraction: data.requireInteraction === true,
      prayer: typeof data.prayer === "string" ? data.prayer : null,
      soundId: typeof data.soundId === "string" ? data.soundId : null,
      mode: typeof data.mode === "string" ? data.mode : "notify",
      prayerAt: typeof data.prayerAt === "number" ? data.prayerAt : null,
      fireAt: typeof data.fireAt === "number" ? data.fireAt : null,
    };
  } catch {
    // Not JSON (a probe, or an older sender): show the text as the body.
    try {
      const text = event.data.text();
      if (text) return { ...fallback, body: text };
    } catch {
      /* fall through */
    }
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);

  event.waitUntil(
    (async () => {
      // Let an open tab play the chosen adhan through the page's audio element;
      // a service worker cannot play audio itself.
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clients) {
          client.postMessage({ type: "awqat:push", payload });
        }
      } catch {
        /* messaging is best-effort */
      }

      // A notification is shown for every push regardless: `userVisibleOnly`
      // subscriptions are revoked by Chrome if a push produces nothing visible.
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: DEFAULT_ICON,
        badge: DEFAULT_BADGE,
        // The tag is unique per prayer per day, so a duplicate delivery
        // replaces the first notification instead of stacking a second one.
        tag: payload.tag,
        // Safe alongside a tag, and the only way a genuine redelivery is
        // noticed; without a tag some browsers throw on this option.
        renotify: Boolean(payload.tag),
        requireInteraction: payload.requireInteraction === true,
        timestamp: payload.prayerAt || Date.now(),
        data: {
          url: payload.url || "/",
          prayer: payload.prayer || null,
          soundId: payload.soundId || null,
          mode: payload.mode || "notify",
          prayerAt: payload.prayerAt || null,
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        // Prefer an existing tab: opening a second copy of a PWA is jarring.
        if (client.url && new URL(client.url).origin === self.location.origin) {
          if ("focus" in client) {
            const focused = await client.focus();
            if (focused && "navigate" in focused && target !== "/") {
              await focused.navigate(target).catch(() => {});
            }
            return;
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});

/**
 * The push service can rotate a subscription without asking. There is no way to
 * re-register from here (the server needs location and settings, which live in
 * the page), so wake any open client and let it re-subscribe.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "awqat:resubscribe" });
      }
    })(),
  );
});
