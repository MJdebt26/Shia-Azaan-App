import { ALERT_PRAYERS } from "./constants";
import { localDateObj, tzOffset } from "./time";
import type { Loc, Times } from "./types";

/**
 * Prayer notifications.
 *
 * Two delivery paths:
 *   1. While the app is open, the running app shows an in-app banner + sound and
 *      a Notification (see PrayerApp). Always works.
 *   2. For delivery when the app is closed, we pre-schedule notifications with
 *      the Notification Triggers API (`TimestampTrigger`). The OS fires them
 *      without the page running. This is supported on Chromium-based browsers
 *      (incl. installed Android PWAs). Where it is unavailable (notably iOS
 *      Safari), background delivery is not possible without a push server — see
 *      the README for the Web Push upgrade path.
 */

const TAG_PREFIX = "awqat-prayer-";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function triggersSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "TimestampTrigger" in window &&
    "serviceWorker" in navigator
  );
}

export function permission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Show a notification right now (used by the in-app alert). */
export async function notifyNow(title: string, body: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
      return;
    }
  } catch {
    /* fall through to page-level Notification */
  }
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

/** Absolute instant for fractional local hour `h` on `base`'s calendar day. */
function instantFor(loc: Loc, base: Date, h: number): Date {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const off = tzOffset(loc.tz, base);
  const ms =
    Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0) -
    off * 3_600_000;
  return new Date(ms);
}

async function getReg(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Cancel any pending (not-yet-fired) scheduled prayer notifications. */
export async function clearScheduled(): Promise<void> {
  const reg = await getReg();
  if (!reg) return;
  try {
    // includeTriggered surfaces notifications scheduled for the future too.
    const opts = { includeTriggered: true } as NotificationOptions & {
      includeTriggered: boolean;
    };
    const list = await reg.getNotifications(opts as never);
    list
      .filter((n) => n.tag?.startsWith(TAG_PREFIX))
      .forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}

/**
 * Schedule background notifications for the rest of today's prayers plus
 * tomorrow's Fajr. Safe to call repeatedly; it clears and rebuilds the queue.
 */
export async function scheduleUpcoming(
  times: Times,
  loc: Loc,
  now: Date = new Date(),
): Promise<void> {
  if (!triggersSupported() || permission() !== "granted") return;
  const reg = await getReg();
  if (!reg) return;

  await clearScheduled();

  const Trigger = (window as unknown as {
    TimestampTrigger: new (ts: number) => unknown;
  }).TimestampTrigger;

  const today = localDateObj(loc, now);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const jobs: { when: Date; en: string; ar: string; tag: string }[] = [];
  for (const p of ALERT_PRAYERS) {
    const when = instantFor(loc, today, times[p.key]);
    if (when.getTime() > now.getTime() + 1000) {
      jobs.push({ when, en: p.en, ar: p.ar, tag: `${TAG_PREFIX}${p.key}-today` });
    }
  }
  // Tomorrow's Fajr so the chain never runs dry overnight.
  const fajr = ALERT_PRAYERS[0];
  jobs.push({
    when: instantFor(loc, tomorrow, times.fajr),
    en: fajr.en,
    ar: fajr.ar,
    tag: `${TAG_PREFIX}fajr-tomorrow`,
  });

  for (const job of jobs) {
    try {
      await reg.showNotification(`${job.en} — time to pray`, {
        body: `${job.ar} · ${loc.name}`,
        tag: job.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        showTrigger: new Trigger(job.when.getTime()),
      } as NotificationOptions & { showTrigger: unknown });
    } catch {
      /* skip a job that fails to schedule */
    }
  }
}
