"use client";

import type { NotificationPermissionState } from "./capabilities";

/**
 * Notification permission and local (foreground) notification display.
 *
 * Kept separate from push subscription because the two failure modes are
 * different and the UI has to distinguish them: permission is a user decision
 * that can be revoked at any time, while a push subscription is an
 * infrastructure fact. Conflating them is how "notifications are on" ends up
 * meaning nothing.
 */

/** Options plus the fields the service worker supports but `Notification` may not. */
export interface LocalNotificationOptions extends NotificationOptions {
  /** Re-alert when a notification with the same tag is replaced. */
  renotify?: boolean;
  /** Action buttons — service-worker notifications only. */
  actions?: { action: string; title: string; icon?: string }[];
  vibrate?: number | number[];
}

const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/icon-192.png";

/** True when this browser exposes the Notification API at all. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission, or "unsupported" where the API does not exist. */
export function currentPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

/**
 * Ask for permission.
 *
 * Must be called from a user gesture — Safari and Chrome both reject prompts
 * raised on page load. Handles the legacy callback signature that older WebKit
 * still ships, where the promise-returning form resolves to undefined.
 */
export async function requestPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybePromise = Notification.requestPermission((value) =>
        resolve(value),
      ) as Promise<NotificationPermission> | undefined;
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve, () => resolve(Notification.permission));
      }
    });
    return result ?? Notification.permission;
  } catch {
    return currentPermission();
  }
}

/** The active service worker registration, or null if there is not one. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    // `ready` never rejects but can hang forever when no worker is registered,
    // so race it — a notification must not be blocked by an install that is
    // still pending.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Show a notification immediately.
 *
 * Prefers `ServiceWorkerRegistration.showNotification`: it is the only form
 * available on Android Chrome and on iOS Home Screen apps, it survives the tab
 * being backgrounded, and it supports tags and actions. The page-level
 * `Notification` constructor is the desktop fallback.
 *
 * Returns whether anything was actually shown, so callers can fall back to an
 * in-app banner instead of assuming success.
 */
export async function showLocalNotification(
  title: string,
  options: LocalNotificationOptions = {},
): Promise<boolean> {
  if (!notificationsSupported() || currentPermission() !== "granted") {
    return false;
  }

  const merged: LocalNotificationOptions = {
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    ...options,
  };

  const reg = await registration();
  if (reg) {
    try {
      await reg.showNotification(title, merged as NotificationOptions);
      return true;
    } catch {
      /* fall through to the page-level constructor */
    }
  }

  try {
    // `actions` throws a TypeError on the constructor form, so strip it.
    const { actions: _actions, ...pageOptions } = merged;
    new Notification(title, pageOptions as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}

/**
 * Close notifications this app previously raised. Used when settings change so
 * a stale "Isha in 10 minutes" does not linger after the user turns Isha off.
 */
export async function closeNotifications(tagPrefix = "awqat-"): Promise<void> {
  const reg = await registration();
  if (!reg) return;
  try {
    const open = await reg.getNotifications();
    for (const n of open) {
      if (!n.tag || n.tag.startsWith(tagPrefix)) n.close();
    }
  } catch {
    /* not fatal — the notifications simply stay on screen */
  }
}
