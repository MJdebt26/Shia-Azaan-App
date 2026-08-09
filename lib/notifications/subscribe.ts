"use client";

import { STORAGE_KEYS } from "@/lib/constants";
import { deviceTimeZone, isValidTimeZone } from "@/lib/time";
import type { AlertSettings, CalcSettings, Loc } from "@/lib/types";
import { currentPermission, requestPermission } from "./permission";

/**
 * Client half of Web Push.
 *
 * The server needs more than the subscription: it recomputes prayer times
 * without the device, so location, calculation method and alert settings travel
 * with the subscription and are re-sent whenever they change.
 *
 * Every function here reports failure explicitly instead of resolving quietly.
 * A push subscription that fails to register and says nothing is exactly the
 * v1 bug in a new costume.
 */

export type SubscribeResult =
  | { ok: true; endpoint: string }
  | { ok: false; error: string };

const SW_URL = "/sw.js";

/**
 * Convert a base64url VAPID key to the `Uint8Array` the Push API demands.
 *
 * `applicationServerKey` must be the raw 65-byte P-256 point. Passing the
 * base64 string works in Chrome and fails in Firefox, which is why this is done
 * explicitly rather than relying on browser coercion. base64url also has to be
 * translated to standard base64 and re-padded before `atob` will accept it.
 */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Register the service worker if it is not already controlling this page.
 * Exported because the offline shell needs it even when push is unavailable.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    return null;
  }
}

/** Fetch the application server key. Null when push is not configured. */
async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/public-key", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { key?: unknown };
      if (typeof data.key === "string" && data.key) return data.key;
    }
  } catch {
    /* offline, or the route is not deployed — fall through */
  }
  // Build-time inlined fallback, so a static export still works.
  const inlined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return typeof inlined === "string" && inlined ? inlined : null;
}

/** Byte-compare an existing subscription's key against the current one. */
function sameApplicationServerKey(
  sub: PushSubscription,
  key: Uint8Array,
): boolean {
  const existing = sub.options.applicationServerKey;
  if (!existing) return false;
  const bytes = new Uint8Array(existing);
  if (bytes.length !== key.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== key[i]) return false;
  }
  return true;
}

/** The timezone the server should use: the location's, else the device's. */
function resolveTimeZone(loc: Loc): string {
  return isValidTimeZone(loc.tz) ? loc.tz : deviceTimeZone();
}

function rememberEndpoint(endpoint: string | null): void {
  try {
    if (endpoint) localStorage.setItem(STORAGE_KEYS.pushEndpoint, endpoint);
    else localStorage.removeItem(STORAGE_KEYS.pushEndpoint);
  } catch {
    /* storage disabled (private mode) — the live subscription is still truth */
  }
}

/** The endpoint recorded at subscribe time, for unsubscribing after a reset. */
export function storedEndpoint(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.pushEndpoint);
  } catch {
    return null;
  }
}

/**
 * Subscribe this device and register its settings with the server.
 *
 * Safe to call repeatedly: the server upserts, so this doubles as "push my
 * latest settings" whenever the user changes a method or a lead time.
 * Must be called from a user gesture the first time, because it may prompt.
 */
export async function subscribeToPush(
  loc: Loc,
  calc: CalcSettings,
  alerts: AlertSettings,
): Promise<SubscribeResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not running in a browser." };
  }
  if (!window.isSecureContext) {
    return { ok: false, error: "Push requires HTTPS (or localhost)." };
  }
  if (!("serviceWorker" in navigator)) {
    return { ok: false, error: "This browser has no service worker support." };
  }
  if (!("PushManager" in window)) {
    return {
      ok: false,
      error:
        "This browser has no Push API. On iPhone and iPad, add Awqāt to the " +
        "Home Screen first (iOS 16.4 or later).",
    };
  }

  const permission =
    currentPermission() === "granted" ? "granted" : await requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications are blocked for this site. Re-enable them in your browser settings."
          : "Notification permission was not granted.",
    };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, error: "The service worker could not be registered." };
  }
  // `register()` resolves before the worker is active; pushManager needs active.
  await navigator.serviceWorker.ready;

  const publicKey = await fetchPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      error:
        "This deployment has no VAPID key configured, so background alerts are " +
        "unavailable. Alerts will still fire while Awqāt is open.",
    };
  }

  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = urlBase64ToUint8Array(publicKey);
  } catch {
    return { ok: false, error: "The server's push key is malformed." };
  }

  let subscription: PushSubscription | null = null;
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      if (sameApplicationServerKey(existing, applicationServerKey)) {
        subscription = existing;
      } else {
        // The deployment's VAPID key rotated; the old subscription can never be
        // signed for again, so replace it rather than leaving a dead endpoint.
        await existing.unsubscribe().catch(() => undefined);
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: `The browser refused the push subscription: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    return { ok: false, error: "The push subscription is missing its keys." };
  }

  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: { endpoint: json.endpoint, keys: { p256dh, auth } },
        loc,
        calc,
        alerts,
        tz: resolveTimeZone(loc),
      }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        error: detail?.error ?? `The server rejected the subscription (${res.status}).`,
      };
    }
  } catch {
    return {
      ok: false,
      error: "Could not reach the server to register for alerts. Check your connection.",
    };
  }

  rememberEndpoint(subscription.endpoint);
  return { ok: true, endpoint: subscription.endpoint };
}

/**
 * Remove this device's subscription, server-side first.
 *
 * Order matters: if the browser unsubscribes first and the network call then
 * fails, the server keeps pushing to an endpoint nobody can delete.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  let subscription: PushSubscription | null = null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    subscription = (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    subscription = null;
  }

  const endpoint = subscription?.endpoint ?? storedEndpoint();
  if (endpoint) {
    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
        keepalive: true,
      });
    } catch {
      /* the server prunes dead endpoints on the next 410 anyway */
    }
  }

  let removed = true;
  if (subscription) {
    try {
      removed = await subscription.unsubscribe();
    } catch {
      removed = false;
    }
  }
  rememberEndpoint(null);
  return removed;
}

/** Whether this device currently holds a live push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}
