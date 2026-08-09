import { PRAYER_BY_KEY } from "@/lib/constants";
import { civilInZone, formatDuration, formatTime } from "@/lib/time";
import type { AlertJob } from "@/lib/prayer/schedule";
import type { AlertMode, AlertableKey, PushRecord } from "@/lib/types";

/**
 * The JSON contract between the push dispatcher and `public/sw.js`.
 *
 * The service worker cannot import application code, so this shape is the only
 * thing keeping the two halves in sync. It is versioned (`v`) so an old service
 * worker that is still installed on a user's device can recognise a payload it
 * does not understand and fall back to a generic notification rather than
 * throwing inside the push event (which would show the browser's own
 * "This site has been updated in the background" placeholder).
 *
 * Keep it small: push services reject payloads over ~4 KB once encrypted.
 */
export interface PushPayload {
  /** Payload schema version. */
  v: 1;
  title: string;
  body: string;
  /** Notification tag — a redelivery replaces rather than stacks. */
  tag: string;
  prayer: AlertableKey;
  /** Adhan catalogue id, so a focused tab can play the right sound. */
  soundId: string;
  mode: AlertMode;
  /** Prayer start time, epoch ms. */
  prayerAt: number;
  /** When this alert was meant to fire, epoch ms. */
  fireAt: number;
  /** Where to go when the notification is tapped. */
  url: string;
  requireInteraction: boolean;
}

/** Fractional local hour of `instant` as seen in `tz`, for display formatting. */
function hoursInZone(instant: Date, tz: string | null): number {
  const c = civilInZone(instant, tz);
  return c.hour + c.minute / 60;
}

/**
 * Turn a scheduled alert into the notification the device will show.
 *
 * Built on the server (not in the service worker) because only the server knows
 * the user's location name and lead-time settings, and because a phone that has
 * been asleep for eight hours must be able to render the notification from the
 * payload alone.
 */
export function buildAlertPayload(job: AlertJob, record: PushRecord): PushPayload {
  const meta = PRAYER_BY_KEY[job.key];
  const setting = record.alerts[job.key];
  const tz = record.tz || record.loc.tz;
  const timeLabel = (() => {
    const f = formatTime(hoursInZone(job.prayerAt, tz), "12h");
    return f.suffix ? `${f.time} ${f.suffix}` : f.time;
  })();
  const place = record.loc.name || record.loc.country || "";
  const lead = Math.max(0, Math.round(setting?.offsetMinutes ?? 0));

  const title =
    lead > 0
      ? `${meta.en} in ${formatDuration(lead)}`
      : `${meta.en} — ${timeLabel}`;

  const bodyParts =
    lead > 0
      ? [`${meta.ar} at ${timeLabel}`]
      : [`${meta.ar} · it is time to pray`];
  if (place) bodyParts.push(place);

  return {
    v: 1,
    title,
    body: bodyParts.join(" · "),
    // The dedupe key is already unique per civil day and prayer, so reusing it
    // as the tag makes a duplicate delivery collapse into one notification.
    tag: `awqat-${job.dedupeKey}`,
    prayer: job.key,
    soundId: setting?.soundId ?? "chime",
    mode: setting?.mode ?? "notify",
    prayerAt: job.prayerAt.getTime(),
    fireAt: job.fireAt.getTime(),
    url: "/",
    // A full adhan alert is meant to be acted on, so keep it on screen until
    // dismissed. A gentle "notify" is allowed to auto-hide.
    requireInteraction: (setting?.mode ?? "notify") === "sound",
  };
}

/**
 * Serialise for `webpush.sendNotification`. A separate function so the size
 * limit is enforced in exactly one place.
 */
export function serializePayload(payload: PushPayload): string {
  const json = JSON.stringify(payload);
  if (json.length > 3500) {
    // Should be unreachable — location names are the only unbounded field —
    // but an oversized payload is rejected by the push service with a 413,
    // which would look like a silent delivery failure.
    return JSON.stringify({ ...payload, body: payload.body.slice(0, 120) });
  }
  return json;
}

/**
 * Push services coalesce by `Topic`, which must be at most 32 URL-safe base64
 * characters. Deriving it from the dedupe key means a queued-but-undelivered
 * alert is replaced by the newer one instead of both arriving at once.
 */
export function topicFor(job: AlertJob): string {
  return job.dedupeKey.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}
