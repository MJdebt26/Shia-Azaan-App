import { computeTimes } from "./times";
import { ALERTABLE, PRAYERS } from "../constants";
import { addDays, dateFromKey, dayKey, instantAt, tzOffsetHours } from "../time";
import type {
  AlertSettings,
  AlertableKey,
  CalcSettings,
  Loc,
  PrayerKey,
  Times,
} from "../types";

/**
 * Turning computed times into *absolute instants*.
 *
 * Everything scheduling-related — the countdown, the foreground alarm and the
 * server-side push cron — goes through this module, so the client and the
 * server can never disagree about when a prayer starts.
 */

/** Compute one day's times for a location. */
export function timesForDay(
  loc: Loc,
  calc: CalcSettings,
  key: string,
): Times {
  const date = dateFromKey(key);
  const offset = tzOffsetHours(loc.tz, date);
  return computeTimes({
    date,
    lat: loc.lat,
    lng: loc.lng,
    tzOffset: offset,
    elevation: loc.elevation,
    calc,
  });
}

export interface PrayerInstant {
  key: PrayerKey;
  /** Civil day the time belongs to. */
  day: string;
  /** Fractional local hour (may exceed 24 when it spills past midnight). */
  hours: number;
  at: Date;
}

/**
 * All prayer instants for a civil day, as absolute Dates.
 * Values past 24h roll into the following day correctly.
 */
export function instantsForDay(
  loc: Loc,
  calc: CalcSettings,
  key: string,
): PrayerInstant[] {
  const times = timesForDay(loc, calc, key);
  return PRAYERS.map((p) => {
    const hours = times[p.key];
    const dayShift = Math.floor(hours / 24);
    const targetDay = dayShift === 0 ? key : addDays(key, dayShift);
    return {
      key: p.key,
      day: key,
      hours,
      at: instantAt(targetDay, hours - dayShift * 24, loc.tz),
    };
  });
}

/**
 * The next prayer strictly after `from`, searching today then tomorrow.
 * Never returns null: tomorrow's Fajr always exists.
 */
export function nextPrayerAfter(
  loc: Loc,
  calc: CalcSettings,
  from: Date,
): PrayerInstant {
  const today = dayKey(loc.tz, from);
  const candidates = [
    ...instantsForDay(loc, calc, today),
    ...instantsForDay(loc, calc, addDays(today, 1)),
  ];
  const found = candidates.find((c) => c.at.getTime() > from.getTime());
  return found ?? candidates[candidates.length - 1];
}

/**
 * The prayer period currently in effect, or null before the day's first
 * prayer has begun.
 */
export function currentPrayerAt(
  loc: Loc,
  calc: CalcSettings,
  at: Date,
): PrayerInstant | null {
  const today = dayKey(loc.tz, at);
  const candidates = [
    ...instantsForDay(loc, calc, addDays(today, -1)),
    ...instantsForDay(loc, calc, today),
  ].filter((c) => c.at.getTime() <= at.getTime());
  return candidates.length ? candidates[candidates.length - 1] : null;
}

export interface AlertJob {
  key: AlertableKey;
  /** When the notification should fire (prayer time minus the lead offset). */
  fireAt: Date;
  /** The prayer's own start time. */
  prayerAt: Date;
  soundId: string;
  /** Stable identity so a job is never delivered twice. */
  dedupeKey: string;
}

/**
 * Alert jobs due in the window `(from, from + horizonHours]`.
 *
 * Used by the foreground scheduler to arm the next timer and by the push cron
 * to decide who to notify this minute.
 */
export function upcomingAlerts(
  loc: Loc,
  calc: CalcSettings,
  alerts: AlertSettings,
  from: Date,
  horizonHours = 26,
): AlertJob[] {
  const today = dayKey(loc.tz, from);
  const days = [addDays(today, -1), today, addDays(today, 1), addDays(today, 2)];
  const until = from.getTime() + horizonHours * 3_600_000;
  const jobs: AlertJob[] = [];

  for (const day of days) {
    const instants = instantsForDay(loc, calc, day);
    for (const inst of instants) {
      if (!ALERTABLE.includes(inst.key as AlertableKey)) continue;
      const setting = alerts[inst.key as AlertableKey];
      if (!setting || setting.mode === "off") continue;

      const fireAt = new Date(
        inst.at.getTime() - setting.offsetMinutes * 60_000,
      );
      const ts = fireAt.getTime();
      if (ts <= from.getTime() || ts > until) continue;

      jobs.push({
        key: inst.key as AlertableKey,
        fireAt,
        prayerAt: inst.at,
        soundId: setting.soundId,
        dedupeKey: `${day}:${inst.key}`,
      });
    }
  }

  return jobs.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
