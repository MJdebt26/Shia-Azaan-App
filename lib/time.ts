import type { FormattedTime, TimeFormat } from "./types";

/**
 * Timezone-correct date helpers.
 *
 * These use `Intl.DateTimeFormat().formatToParts()` rather than the common
 * `new Date(d.toLocaleString("en-US", { timeZone }))` round-trip. That trick
 * silently misparses in several locales and loses sub-minute precision; it was
 * the source of off-by-an-hour bugs around DST transitions.
 */

export interface CivilDateTime {
  year: number;
  /** 1-based. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** True when the runtime accepts this IANA zone. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The device's own IANA zone, or "UTC" if unavailable. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Wall-clock fields of `instant` as seen in `tz`. */
export function civilInZone(instant: Date, tz: string | null): CivilDateTime {
  if (!isValidTimeZone(tz)) {
    return {
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
      second: instant.getSeconds(),
    };
  }
  const parts = formatterFor(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  // `hourCycle: "h23"` still emits 24 for midnight in some ICU builds.
  const hour = get("hour") % 24;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** UTC offset in hours that `tz` is at during `instant` (DST-aware). */
export function tzOffsetHours(tz: string | null, instant: Date): number {
  if (!isValidTimeZone(tz)) return -instant.getTimezoneOffset() / 60;
  const c = civilInZone(instant, tz);
  const asUTC = Date.UTC(
    c.year,
    c.month - 1,
    c.day,
    c.hour,
    c.minute,
    c.second,
  );
  // Round to the nearest minute: zones are always whole minutes, and this
  // absorbs the millisecond the formatter discards.
  return Math.round((asUTC - instant.getTime()) / 60000) / 60;
}

/** Fractional hours [0,24) of the current wall clock in `tz`. */
export function localHours(tz: string | null, instant: Date): number {
  const c = civilInZone(instant, tz);
  return c.hour + c.minute / 60 + c.second / 3600;
}

/** Stable `YYYY-MM-DD` key for the civil day in `tz`. */
export function dayKey(tz: string | null, instant: Date): string {
  const c = civilInZone(instant, tz);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

/** Parse a `YYYY-MM-DD` key into a local-noon Date (noon avoids DST edges). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Shift a day key by whole days. */
export function addDays(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The absolute instant of fractional local hour `hours` on civil day `key`
 * in zone `tz`.
 *
 * Handles DST by solving twice: the offset that applies *at the target time*
 * may differ from the offset at midnight.
 */
export function instantAt(key: string, hours: number, tz: string | null): Date {
  const [y, m, d] = key.split("-").map(Number);
  const wholeMinutes = Math.round(hours * 60);
  const hh = Math.floor(wholeMinutes / 60);
  const mm = wholeMinutes % 60;

  const naiveUTC = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  if (!isValidTimeZone(tz)) {
    // Device-local: let the Date constructor apply the local rules.
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  let offset = tzOffsetHours(tz, new Date(naiveUTC));
  let guess = new Date(naiveUTC - offset * 3_600_000);
  // One refinement is enough for every real zone transition.
  const refined = tzOffsetHours(tz, guess);
  if (refined !== offset) {
    offset = refined;
    guess = new Date(naiveUTC - offset * 3_600_000);
  }
  return guess;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format fractional hours for display, rounding to the nearest minute. */
export function formatTime(
  hours: number | null | undefined,
  format: TimeFormat,
): FormattedTime {
  if (hours == null || !Number.isFinite(hours)) return { time: "—", suffix: "" };
  let total = Math.round(((hours % 24) + 24) % 24 * 60);
  total %= 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (format === "24h") {
    return {
      time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      suffix: "",
    };
  }
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${h12}:${String(m).padStart(2, "0")}`, suffix };
}

/** Compact duration, e.g. "3h 04m", "12m", "just now". */
export function formatDuration(minutesTotal: number): string {
  const mins = Math.max(0, Math.round(minutesTotal));
  if (mins <= 0) return "now";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Long-form duration for screen readers, e.g. "3 hours 4 minutes". */
export function describeDuration(minutesTotal: number): string {
  const mins = Math.max(0, Math.round(minutesTotal));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function gregorianLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Hijri date, with a user offset in days.
 *
 * Communities begin the month on local moon sighting, so a ±1–2 day
 * correction is expected and is exposed in Settings rather than hidden.
 */
export function hijriLabel(key: string, offsetDays = 0): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + offsetDays);
  for (const locale of ["en-TN-u-ca-islamic", "en-u-ca-islamic"]) {
    try {
      const s = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
      return `${s.replace(/\s*AH\s*$/, "")} AH`;
    } catch {
      /* try the next locale */
    }
  }
  return "";
}
