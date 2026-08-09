import { NextResponse } from "next/server";
import { NO_ADJUSTMENTS, PRAYERS } from "@/lib/constants";
import { METHODS } from "@/lib/prayer/methods";
import { getPushStore } from "@/lib/push/store";
import { isPushConfigured } from "@/lib/push/vapid";
import { isValidTimeZone } from "@/lib/time";
import type {
  Adjustments,
  AlertMode,
  AlertSettings,
  AlertableKey,
  AsrFactor,
  CalcSettings,
  HighLatRule,
  Loc,
  MethodKey,
  PrayerAlertSetting,
  PushRecord,
} from "@/lib/types";

/**
 * POST /api/push/subscribe — register a device for background prayer alerts.
 *
 * The whole body is untrusted input from a public endpoint, and it is later fed
 * straight into the astronomy engine and into a signed push request. So nothing
 * is taken on trust: every field is range-checked, every enum is checked against
 * the real table, and unknown properties are dropped rather than persisted. A
 * malformed body gets a 400 with a reason instead of poisoning the cron job.
 *
 * `web-push` and `node:crypto` need the Node runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bodies are ~1 KB in practice; anything far larger is not a real client. */
const MAX_BODY_BYTES = 32_000;

type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const HIGH_LAT_RULES: HighLatRule[] = [
  "none",
  "middle_of_night",
  "one_seventh",
  "angle_based",
];
const ALERT_MODES: AlertMode[] = ["off", "notify", "sound"];
const LOC_SOURCES: NonNullable<Loc["source"]>[] = [
  "gps",
  "city",
  "manual",
  "default",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Clamp a numeric field to a sane range instead of rejecting the whole body. */
function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = finiteNumber(value);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // Strip control characters: these end up in notification bodies.
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Push endpoints are always https URLs issued by the browser's push service.
 * Anything else is either a broken client or an attempt to make this server
 * issue requests somewhere it should not.
 */
function validateEndpoint(value: unknown): Validated<string> {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return { ok: false, error: "subscription.endpoint must be a URL string." };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "subscription.endpoint is not a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "subscription.endpoint must use https." };
  }
  if (!url.hostname || url.hostname === "localhost") {
    return { ok: false, error: "subscription.endpoint has no public host." };
  }
  return { ok: true, value: url.toString() };
}

/** base64url with optional padding, which is how the Push API encodes keys. */
function validateKey(
  value: unknown,
  field: string,
  min: number,
  max: number,
): Validated<string> {
  if (typeof value !== "string" || !/^[A-Za-z0-9_\-=]+$/.test(value)) {
    return { ok: false, error: `${field} must be a base64url string.` };
  }
  if (value.length < min || value.length > max) {
    return { ok: false, error: `${field} has an implausible length.` };
  }
  return { ok: true, value };
}

function validateSubscription(
  value: unknown,
): Validated<PushRecord["subscription"]> {
  if (!isRecord(value)) {
    return { ok: false, error: "subscription must be an object." };
  }
  const endpoint = validateEndpoint(value.endpoint);
  if (!endpoint.ok) return endpoint;

  const keys = value.keys;
  if (!isRecord(keys)) {
    return { ok: false, error: "subscription.keys is missing." };
  }
  const p256dh = validateKey(keys.p256dh, "subscription.keys.p256dh", 40, 256);
  if (!p256dh.ok) return p256dh;
  const auth = validateKey(keys.auth, "subscription.keys.auth", 16, 64);
  if (!auth.ok) return auth;

  return {
    ok: true,
    value: {
      endpoint: endpoint.value,
      keys: { p256dh: p256dh.value, auth: auth.value },
    },
  };
}

/**
 * Location, with coordinates hard-rejected out of range: a latitude of 950
 * would send the solar-position solver into NaN and the record would then fail
 * silently every minute forever.
 */
function validateLoc(value: unknown, resolvedTz: string): Validated<Loc> {
  if (!isRecord(value)) return { ok: false, error: "loc must be an object." };

  const lat = finiteNumber(value.lat);
  const lng = finiteNumber(value.lng);
  if (lat === null || lat < -90 || lat > 90) {
    return { ok: false, error: "loc.lat must be a number between -90 and 90." };
  }
  if (lng === null || lng < -180 || lng > 180) {
    return { ok: false, error: "loc.lng must be a number between -180 and 180." };
  }

  const source = LOC_SOURCES.find((s) => s === value.source);
  const elevation = finiteNumber(value.elevation);

  const loc: Loc = {
    name: safeString(value.name, 120) || "Saved location",
    country: safeString(value.country, 120),
    lat,
    lng,
    // The server has no device timezone to fall back on — a null here would
    // silently compute every prayer in the host's UTC. Always store a real zone.
    tz: resolvedTz,
    source: source ?? "manual",
  };
  if (elevation !== null) {
    loc.elevation = Math.min(9000, Math.max(-500, elevation));
  }
  return { ok: true, value: loc };
}

/**
 * Calculation settings are repaired rather than rejected: an unknown method key
 * from an older client should fall back to the default, not stop a device from
 * ever receiving an alert again.
 */
function validateCalc(value: unknown): CalcSettings {
  const raw = isRecord(value) ? value : {};
  const method: MethodKey =
    typeof raw.method === "string" && raw.method in METHODS
      ? (raw.method as MethodKey)
      : "jafari_leva";

  const adjustmentsRaw = isRecord(raw.adjustments) ? raw.adjustments : {};
  const adjustments = { ...NO_ADJUSTMENTS } as Adjustments;
  for (const prayer of PRAYERS) {
    adjustments[prayer.key] = Math.round(
      clampNumber(adjustmentsRaw[prayer.key], -180, 180, 0),
    );
  }

  return {
    method,
    customFajrAngle: clampNumber(raw.customFajrAngle, 0, 30, 16),
    customIshaAngle: clampNumber(raw.customIshaAngle, 0, 30, 14),
    asrFactor: (raw.asrFactor === 2 ? 2 : 1) as AsrFactor,
    highLatRule:
      HIGH_LAT_RULES.find((r) => r === raw.highLatRule) ?? "angle_based",
    adjustments,
    imsakMinutes: Math.round(clampNumber(raw.imsakMinutes, 0, 120, 10)),
  };
}

/** Alert settings, likewise repaired per prayer. */
function validateAlerts(value: unknown): AlertSettings {
  const raw = isRecord(value) ? value : {};
  const out = {} as AlertSettings;
  const keys: AlertableKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  for (const key of keys) {
    const entry = isRecord(raw[key]) ? (raw[key] as Record<string, unknown>) : {};
    const soundId = safeString(entry.soundId, 64).replace(/[^A-Za-z0-9_-]/g, "");
    const setting: PrayerAlertSetting = {
      mode: ALERT_MODES.find((m) => m === entry.mode) ?? "off",
      soundId: soundId || "chime",
      // A lead time beyond two hours is meaningless and would let one device
      // occupy several dispatch windows.
      offsetMinutes: Math.round(clampNumber(entry.offsetMinutes, 0, 120, 0)),
    };
    out[key] = setting;
  }
  return out;
}

/** The zone the server computes in: the explicit `tz`, else the location's. */
function resolveTimeZone(body: Record<string, unknown>): string | null {
  if (typeof body.tz === "string" && isValidTimeZone(body.tz)) return body.tz;
  const loc = body.loc;
  if (isRecord(loc) && typeof loc.tz === "string" && isValidTimeZone(loc.tz)) {
    return loc.tz;
  }
  return null;
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Push is not configured on this deployment, so background alerts " +
          "cannot be registered.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Request body is too large." },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return badRequest("Body must be valid JSON.");
  }
  if (!isRecord(body)) return badRequest("Body must be a JSON object.");

  const subscription = validateSubscription(body.subscription);
  if (!subscription.ok) return badRequest(subscription.error);

  const tz = resolveTimeZone(body);
  if (!tz) {
    return badRequest(
      "A valid IANA timezone is required (tz, or loc.tz) — the server has no " +
        "other way to know when your prayers fall.",
    );
  }

  const loc = validateLoc(body.loc, tz);
  if (!loc.ok) return badRequest(loc.error);

  const store = getPushStore();
  const now = Date.now();

  // Upsert: re-subscribing from the same device must update settings, not
  // create a second record that would double every notification.
  let createdAt = now;
  let lastSentKey: string | undefined;
  try {
    const existing = await store.get(subscription.value.endpoint);
    if (existing) {
      createdAt = existing.createdAt;
      // Keep the dedupe watermark so changing a setting seconds before Maghrib
      // cannot replay an alert that already went out.
      lastSentKey = existing.lastSentKey;
    }
  } catch {
    /* a read failure must not block a new subscription */
  }

  const record: PushRecord = {
    subscription: subscription.value,
    loc: loc.value,
    calc: validateCalc(body.calc),
    alerts: validateAlerts(body.alerts),
    tz,
    createdAt,
    updatedAt: now,
  };
  if (lastSentKey) record.lastSentKey = lastSentKey;

  try {
    await store.put(record);
  } catch (error) {
    console.error("[awqat/push] failed to store subscription", error);
    return NextResponse.json(
      { ok: false, error: "Could not save the subscription. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
