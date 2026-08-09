import { describe, expect, it } from "vitest";

import {
  currentPrayerAt,
  instantsForDay,
  nextPrayerAfter,
  timesForDay,
  upcomingAlerts,
  type AlertJob,
  type PrayerInstant,
} from "../lib/prayer/schedule";
import { ALERTABLE, DEFAULT_ALERTS, DEFAULT_CALC, PRAYERS } from "../lib/constants";
import { addDays, civilInZone, dayKey, deviceTimeZone, instantAt, tzOffsetHours } from "../lib/time";
import type { AlertSettings, CalcSettings, Loc } from "../lib/types";

/**
 * Scheduling tests.
 *
 * The engine's own accuracy is covered by tests/prayer.test.ts; what matters
 * here is the mapping from "fractional local hours" to absolute instants, and
 * the invariants the countdown, the foreground alarm and the push cron all
 * depend on: strictly increasing instants, a next prayer that is always in the
 * future, a current prayer that is never in the future, and alert jobs that are
 * sorted, de-duplicated and inside the requested horizon.
 */

const calc = (over: Partial<CalcSettings> = {}): CalcSettings => ({
  ...DEFAULT_CALC,
  adjustments: { ...DEFAULT_CALC.adjustments },
  ...over,
});

const CALC = calc();

const QOM: Loc = { name: "Qom", country: "Iran", lat: 34.6401, lng: 50.8764, tz: "Asia/Tehran" };
const NEW_YORK: Loc = { name: "New York", country: "USA", lat: 40.7128, lng: -74.006, tz: "America/New_York" };
const SYDNEY: Loc = { name: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" };
const KATHMANDU: Loc = { name: "Kathmandu", country: "Nepal", lat: 27.7172, lng: 85.324, tz: "Asia/Kathmandu" };
/** 64°N and no DST: in June both Maghrib and Isha land after local midnight. */
const REYKJAVIK: Loc = { name: "Reykjavik", country: "Iceland", lat: 64.1466, lng: -21.9426, tz: "Atlantic/Reykjavik" };

/** Locations whose prayer times all stay inside their own civil day. */
const SAME_DAY_LOCS = [QOM, NEW_YORK, SYDNEY, KATHMANDU];

const DAYS = [
  "2024-01-15", // deep winter
  "2024-03-10", // US spring-forward
  "2024-03-31", // EU spring-forward
  "2024-06-21", // solstice
  "2024-10-06", // Australian spring-forward
  "2024-11-03", // US fall-back
  "2024-12-21", // solstice
];

/**
 * Days and locations used for the hour-by-hour sweeps. Each probe recomputes a
 * day or two of astronomy, so the matrix is kept to the cases that can actually
 * break: both US DST transitions, both solstices, and one location per class
 * (no DST, northern DST, southern DST, spills past midnight).
 */
const SWEEP_DAYS = ["2024-03-10", "2024-06-21", "2024-11-03", "2024-12-21"];
const SWEEP_LOCS = [QOM, NEW_YORK, SYDNEY, REYKJAVIK];
/** A sweep is ~400 astronomy-heavy probes; the 5s default is too tight. */
const SWEEP_TIMEOUT = 60_000;

/** Every instant across `spanDays` centred on `key`, sorted by absolute time. */
function sortedWindow(
  loc: Loc,
  key: string,
  before: number,
  after: number,
): PrayerInstant[] {
  const out: PrayerInstant[] = [];
  for (let d = -before; d <= after; d++) {
    out.push(...instantsForDay(loc, CALC, addDays(key, d)));
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Wall-clock probes: every hour of `key`, as absolute instants. */
function hourlyProbes(loc: Loc, key: string): Date[] {
  const probes: Date[] = [];
  for (let h = 0; h < 24; h++) probes.push(instantAt(key, h, loc.tz));
  return probes;
}

// ---------------------------------------------------------------------------
// instantsForDay
// ---------------------------------------------------------------------------

describe("instantsForDay", () => {
  it("returns the six timetable rows, in order, for every location and date", () => {
    for (const loc of [...SAME_DAY_LOCS, REYKJAVIK]) {
      for (const key of DAYS) {
        const instants = instantsForDay(loc, CALC, key);
        expect(instants, `${loc.name} ${key}`).toHaveLength(6);
        expect(instants.map((i) => i.key)).toEqual(PRAYERS.map((p) => p.key));
        // `day` is the day the row belongs to in the UI, even when the instant
        // itself has spilled past midnight.
        expect(instants.every((i) => i.day === key)).toBe(true);
      }
    }
  });

  it("is strictly increasing in absolute time", () => {
    for (const loc of [...SAME_DAY_LOCS, REYKJAVIK]) {
      for (const key of DAYS) {
        const instants = instantsForDay(loc, CALC, key);
        for (let i = 1; i < instants.length; i++) {
          expect(
            instants[i].at.getTime(),
            `${loc.name} ${key}: ${instants[i].key} must follow ${instants[i - 1].key}`,
          ).toBeGreaterThan(instants[i - 1].at.getTime());
        }
        expect(instants.every((i) => Number.isFinite(i.at.getTime()))).toBe(true);
      }
    }
  });

  it("carries the engine's fractional hours through untouched", () => {
    const key = "2024-06-21";
    const times = timesForDay(QOM, CALC, key);
    for (const inst of instantsForDay(QOM, CALC, key)) {
      expect(inst.hours).toBe(times[inst.key]);
    }
  });

  it("keeps ordinary locations inside their own civil day", () => {
    for (const loc of SAME_DAY_LOCS) {
      for (const key of DAYS) {
        for (const inst of instantsForDay(loc, CALC, key)) {
          expect(dayKey(loc.tz, inst.at), `${loc.name} ${key} ${inst.key}`).toBe(key);
        }
      }
    }
  });

  it("maps values past 24h onto the NEXT calendar day", () => {
    const key = "2024-06-21";
    const instants = instantsForDay(REYKJAVIK, CALC, key);
    const byKey = Object.fromEntries(instants.map((i) => [i.key, i]));

    // Precondition for this test to mean anything.
    expect(byKey.maghrib.hours).toBeGreaterThan(24);
    expect(byKey.isha.hours).toBeGreaterThan(24);
    expect(byKey.asr.hours).toBeLessThan(24);

    for (const spilled of [byKey.maghrib, byKey.isha]) {
      expect(dayKey(REYKJAVIK.tz, spilled.at)).toBe("2024-06-22");
      const civil = civilInZone(spilled.at, REYKJAVIK.tz);
      const minutes = Math.round((spilled.hours - 24) * 60);
      expect(civil.hour).toBe(Math.floor(minutes / 60));
      expect(civil.minute).toBe(minutes % 60);
      // ...and it is exactly what an explicit next-day resolution would give.
      expect(spilled.at.getTime()).toBe(
        instantAt("2024-06-22", spilled.hours - 24, REYKJAVIK.tz).getTime(),
      );
    }

    // The row still belongs to the 21st, and Isha still follows Maghrib.
    expect(byKey.isha.day).toBe(key);
    expect(byKey.isha.at.getTime()).toBeGreaterThan(byKey.maghrib.at.getTime());
    // Iceland has no DST, so the absolute gap must equal the hour difference.
    expect(byKey.isha.at.getTime() - byKey.maghrib.at.getTime()).toBe(
      (Math.round(byKey.isha.hours * 60) - Math.round(byKey.maghrib.hours * 60)) * 60_000,
    );
  });

  it("keeps consecutive days butted up against each other without gaps or overlap", () => {
    // Yesterday's last instant must precede today's first one — the property
    // currentPrayerAt relies on when it looks one day back.
    for (const loc of [...SAME_DAY_LOCS, REYKJAVIK]) {
      for (const key of DAYS) {
        const yesterday = instantsForDay(loc, CALC, addDays(key, -1));
        const today = instantsForDay(loc, CALC, key);
        expect(
          yesterday[yesterday.length - 1].at.getTime(),
          `${loc.name} ${key}`,
        ).toBeLessThan(today[0].at.getTime());
      }
    }
  });
});

// ---------------------------------------------------------------------------
// nextPrayerAfter
// ---------------------------------------------------------------------------

describe("nextPrayerAfter", () => {
  it(
    "is strictly in the future for every hour of every probed day",
    () => {
      for (const loc of SWEEP_LOCS) {
        for (const key of SWEEP_DAYS) {
          for (const probe of hourlyProbes(loc, key)) {
            const next = nextPrayerAfter(loc, CALC, probe);
            expect(
              next.at.getTime(),
              `${loc.name} ${key} @${probe.toISOString()} → ${next.key}`,
            ).toBeGreaterThan(probe.getTime());
            // Never more than a day away: something is always coming up.
            expect(next.at.getTime() - probe.getTime()).toBeLessThan(24 * 3_600_000);
            expect(PRAYERS.some((p) => p.key === next.key)).toBe(true);
          }
        }
      }
    },
    SWEEP_TIMEOUT,
  );

  it(
    "stays strictly in the future across a DST transition, minute by minute",
    () => {
      // One-minute resolution through the transition itself (the hour that
      // vanishes in March and repeats in November), then coarser over the rest
      // of the day. A next prayer in the past here would freeze the countdown.
      for (const key of ["2024-03-10", "2024-11-03"]) {
        const start = instantAt(key, 0, NEW_YORK.tz);
        const probeMinutes = new Set<number>();
        for (let m = 0; m <= 4 * 60; m++) probeMinutes.add(m);
        for (let m = 0; m <= 25 * 60; m += 13) probeMinutes.add(m);
        for (const m of probeMinutes) {
          const probe = new Date(start.getTime() + m * 60_000);
          const next = nextPrayerAfter(NEW_YORK, CALC, probe);
          expect(next.at.getTime(), `${key} +${m}m`).toBeGreaterThan(probe.getTime());
        }
      }
    },
    SWEEP_TIMEOUT,
  );

  it(
    "picks the earliest future instant, not merely a future one",
    () => {
      for (const loc of SAME_DAY_LOCS) {
        for (const key of SWEEP_DAYS) {
          const truth = sortedWindow(loc, key, 1, 2);
          for (const probe of hourlyProbes(loc, key)) {
            const next = nextPrayerAfter(loc, CALC, probe);
            const earliest = truth.find((c) => c.at.getTime() > probe.getTime());
            expect(earliest, `${loc.name} ${key}`).toBeDefined();
            expect(next.at.getTime(), `${loc.name} ${key} @${probe.toISOString()}`).toBe(
              earliest!.at.getTime(),
            );
            expect(next.key).toBe(earliest!.key);
          }
        }
      }
    },
    SWEEP_TIMEOUT,
  );

  it("moves on the instant a prayer arrives, and does not stick", () => {
    const key = "2024-06-21";
    for (const loc of SAME_DAY_LOCS) {
      const instants = instantsForDay(loc, CALC, key);
      for (let i = 0; i < instants.length; i++) {
        const exact = instants[i].at;
        // Exactly at the prayer: the countdown must already point past it.
        const next = nextPrayerAfter(loc, CALC, exact);
        expect(next.at.getTime(), `${loc.name} ${instants[i].key}`).toBeGreaterThan(
          exact.getTime(),
        );
        if (i + 1 < instants.length) {
          expect(next.key).toBe(instants[i + 1].key);
        }
        // One millisecond before it, the prayer itself is what is next.
        const before = nextPrayerAfter(loc, CALC, new Date(exact.getTime() - 1));
        expect(before.key).toBe(instants[i].key);
        expect(before.at.getTime()).toBe(exact.getTime());
      }
    }
  });
});

// ---------------------------------------------------------------------------
// currentPrayerAt
// ---------------------------------------------------------------------------

describe("currentPrayerAt", () => {
  it(
    "brackets 'now' with nextPrayerAfter and is the latest prayer already passed",
    () => {
      for (const loc of SWEEP_LOCS) {
        for (const key of SWEEP_DAYS) {
          const truth = sortedWindow(loc, key, 2, 1);
          for (const probe of hourlyProbes(loc, key)) {
            const label = `${loc.name} ${key} @${probe.toISOString()}`;
            const current = currentPrayerAt(loc, CALC, probe);
            const next = nextPrayerAfter(loc, CALC, probe);

            expect(current, label).not.toBeNull();
            // current <= now < next, with no way for the two to cross.
            expect(current!.at.getTime(), label).toBeLessThanOrEqual(probe.getTime());
            expect(next.at.getTime(), label).toBeGreaterThan(probe.getTime());
            expect(current!.at.getTime(), label).toBeLessThan(next.at.getTime());

            // ...and `current` really is the most recent one, not just any.
            const passed = truth.filter((c) => c.at.getTime() <= probe.getTime());
            const latest = passed[passed.length - 1];
            expect(current!.at.getTime(), label).toBe(latest.at.getTime());
            expect(current!.key, label).toBe(latest.key);
          }
        }
      }
    },
    SWEEP_TIMEOUT,
  );

  it("is exact at the boundary: a prayer becomes current at its own instant", () => {
    const instants = instantsForDay(QOM, CALC, "2024-06-21");
    for (const inst of instants) {
      expect(currentPrayerAt(QOM, CALC, inst.at)!.key).toBe(inst.key);
      const justBefore = currentPrayerAt(QOM, CALC, new Date(inst.at.getTime() - 1))!;
      expect(justBefore.key).not.toBe(inst.key);
      expect(justBefore.at.getTime()).toBeLessThan(inst.at.getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// upcomingAlerts
// ---------------------------------------------------------------------------

/** Build alert settings from a compact description. */
function alertsWith(over: Partial<AlertSettings>): AlertSettings {
  const base = Object.fromEntries(
    ALERTABLE.map((k) => [k, { ...DEFAULT_ALERTS[k] }]),
  ) as AlertSettings;
  return { ...base, ...over };
}

/** Shared assertions every result set must satisfy. */
function assertWellFormed(jobs: AlertJob[], from: Date, horizonHours: number) {
  const until = from.getTime() + horizonHours * 3_600_000;
  for (let i = 1; i < jobs.length; i++) {
    expect(jobs[i].fireAt.getTime()).toBeGreaterThanOrEqual(jobs[i - 1].fireAt.getTime());
  }
  for (const job of jobs) {
    expect(job.fireAt.getTime(), `job ${job.dedupeKey} must be in the future`).toBeGreaterThan(
      from.getTime(),
    );
    expect(job.fireAt.getTime(), `job ${job.dedupeKey} must be inside the horizon`).toBeLessThanOrEqual(
      until,
    );
    expect(ALERTABLE.includes(job.key)).toBe(true);
  }
  const keys = jobs.map((j) => j.dedupeKey);
  expect(new Set(keys).size, `dedupeKeys must be unique: ${keys.join(", ")}`).toBe(keys.length);
}

describe("upcomingAlerts", () => {
  const FROM = new Date("2024-06-21T09:00:00Z"); // 12:30 in Qom

  it("returns sorted, unique, in-horizon jobs for the default settings", () => {
    const jobs = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM);
    assertWellFormed(jobs, FROM, 26);
    // A 26-hour horizon must cover all five alertable prayers at least once.
    expect(new Set(jobs.map((j) => j.key)).size).toBe(ALERTABLE.length);
    for (const job of jobs) {
      expect(job.soundId).toBe(DEFAULT_ALERTS[job.key].soundId);
      expect(job.dedupeKey).toMatch(/^\d{4}-\d{2}-\d{2}:[a-z]+$/);
    }
  });

  it("excludes prayers whose mode is 'off' and keeps 'notify' ones", () => {
    const settings = alertsWith({
      fajr: { mode: "off", soundId: "chime", offsetMinutes: 0 },
      asr: { mode: "off", soundId: "chime", offsetMinutes: 0 },
      dhuhr: { mode: "notify", soundId: "none", offsetMinutes: 0 },
    });
    const jobs = upcomingAlerts(QOM, CALC, settings, FROM);
    assertWellFormed(jobs, FROM, 26);
    expect(jobs.some((j) => j.key === "fajr")).toBe(false);
    expect(jobs.some((j) => j.key === "asr")).toBe(false);
    expect(jobs.some((j) => j.key === "dhuhr")).toBe(true);
    expect(jobs.some((j) => j.key === "maghrib")).toBe(true);

    // Turning everything off must yield nothing at all.
    const allOff = alertsWith(
      Object.fromEntries(
        ALERTABLE.map((k) => [k, { mode: "off", soundId: "chime", offsetMinutes: 0 }]),
      ) as Partial<AlertSettings>,
    );
    expect(upcomingAlerts(QOM, CALC, allOff, FROM)).toEqual([]);
  });

  it("treats offsetMinutes as a LEAD time, firing before the prayer", () => {
    const settings = alertsWith({
      maghrib: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 20 },
      isha: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 45 },
    });
    const jobs = upcomingAlerts(QOM, CALC, settings, FROM);
    assertWellFormed(jobs, FROM, 26);

    const plain = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM);
    const prayerAt = (list: AlertJob[], key: string) =>
      list.find((j) => j.key === key)!.prayerAt.getTime();

    for (const [key, lead] of [["maghrib", 20], ["isha", 45]] as const) {
      const job = jobs.find((j) => j.key === key)!;
      // The prayer itself has not moved...
      expect(job.prayerAt.getTime()).toBe(prayerAt(plain, key));
      // ...only the firing time, and it is *earlier*.
      expect(job.prayerAt.getTime() - job.fireAt.getTime()).toBe(lead * 60_000);
      expect(job.fireAt.getTime()).toBeLessThan(job.prayerAt.getTime());
    }
    // Zero offset means fire exactly on time.
    const dhuhr = jobs.find((j) => j.key === "dhuhr")!;
    expect(dhuhr.fireAt.getTime()).toBe(dhuhr.prayerAt.getTime());
  });

  it("pulls a prayer that sits beyond the horizon into it via a long lead", () => {
    // Choose a moment just outside a three-hour horizon for the next prayer.
    const next = nextPrayerAfter(QOM, CALC, FROM);
    const from = new Date(next.at.getTime() - 3.5 * 3_600_000);
    const noLead = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, from, 3);
    expect(noLead.some((j) => j.prayerAt.getTime() === next.at.getTime())).toBe(false);

    const settings = alertsWith({
      [next.key as "asr"]: { mode: "sound", soundId: "chime", offsetMinutes: 60 },
    });
    const withLead = upcomingAlerts(QOM, CALC, settings, from, 3);
    const job = withLead.find((j) => j.prayerAt.getTime() === next.at.getTime());
    expect(job, "a 60-minute lead should bring the prayer inside a 3h horizon").toBeDefined();
    expect(job!.prayerAt.getTime()).toBeGreaterThan(from.getTime() + 3 * 3_600_000);
    assertWellFormed(withLead, from, 3);
  });

  it("respects the horizon exactly, including the empty case", () => {
    expect(upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM, 0)).toEqual([]);
    expect(upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM, 0.001)).toEqual([]);

    // A horizon that ends exactly on a prayer must include it; one millisecond
    // short must not.
    const next = nextPrayerAfter(QOM, CALC, FROM);
    const gapHours = (next.at.getTime() - FROM.getTime()) / 3_600_000;
    const inclusive = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM, gapHours);
    expect(inclusive.map((j) => j.prayerAt.getTime())).toContain(next.at.getTime());
    const exclusive = upcomingAlerts(
      QOM,
      CALC,
      DEFAULT_ALERTS,
      FROM,
      gapHours - 1 / 3_600_000,
    );
    expect(exclusive.map((j) => j.prayerAt.getTime())).not.toContain(next.at.getTime());

    // Nothing fires at `from` itself: the window is half-open.
    const atPrayer = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, next.at, 26);
    expect(atPrayer.map((j) => j.prayerAt.getTime())).not.toContain(next.at.getTime());
  });

  it("finds every alertable instant in the window, even for a spilling location", () => {
    // Brute-force over a much wider range of days than upcomingAlerts scans, to
    // prove its four-day window is wide enough — including the Reykjavik case
    // where a prayer belongs to one civil day but lands on the next.
    const settings = alertsWith({
      fajr: { mode: "sound", soundId: "chime", offsetMinutes: 30 },
      isha: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 180 },
    });
    for (const loc of [REYKJAVIK, QOM, SYDNEY]) {
      for (const key of ["2024-06-21", "2024-11-03"]) {
        for (const hour of [0, 6, 13, 23]) {
          const from = instantAt(key, hour, loc.tz);
          const horizon = 26;
          const jobs = upcomingAlerts(loc, CALC, settings, from, horizon);
          assertWellFormed(jobs, from, horizon);

          const until = from.getTime() + horizon * 3_600_000;
          const expected: string[] = [];
          for (let d = -4; d <= 5; d++) {
            const day = addDays(key, d);
            for (const inst of instantsForDay(loc, CALC, day)) {
              if (!ALERTABLE.includes(inst.key as "fajr")) continue;
              const setting = settings[inst.key as "fajr"];
              const fire = inst.at.getTime() - setting.offsetMinutes * 60_000;
              if (fire > from.getTime() && fire <= until) expected.push(`${day}:${inst.key}`);
            }
          }
          expect(
            jobs.map((j) => j.dedupeKey).sort(),
            `${loc.name} ${key} @${hour}h`,
          ).toEqual(expected.sort());
        }
      }
    }
  });

  it("gives the same prayer on two different days two different dedupe keys", () => {
    // Start just before Fajr so a 26-hour horizon catches the next one too.
    const day = "2024-06-21";
    const fajr = instantsForDay(QOM, CALC, day).find((i) => i.key === "fajr")!;
    const from = new Date(fajr.at.getTime() - 5 * 60_000);
    const jobs = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, from, 26);
    assertWellFormed(jobs, from, 26);
    const fajrJobs = jobs.filter((j) => j.key === "fajr");
    expect(fajrJobs.length).toBe(2);
    expect(fajrJobs[0].dedupeKey).toBe(`${day}:fajr`);
    expect(fajrJobs[1].dedupeKey).toBe(`${addDays(day, 1)}:fajr`);
  });

  it("produces stable keys and times when re-armed from a slightly later moment", () => {
    // The foreground scheduler re-runs this every tick; a job must not change
    // identity or time just because the clock moved on.
    const first = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM);
    const later = upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, new Date(FROM.getTime() + 300_000));
    const byKey = new Map(first.map((j) => [j.dedupeKey, j]));
    for (const job of later) {
      const before = byKey.get(job.dedupeKey);
      if (!before) continue; // newly entered the horizon
      expect(before.fireAt.getTime()).toBe(job.fireAt.getTime());
      expect(before.prayerAt.getTime()).toBe(job.prayerAt.getTime());
      expect(before.soundId).toBe(job.soundId);
    }
    // Re-running with identical input is deterministic.
    expect(upcomingAlerts(QOM, CALC, DEFAULT_ALERTS, FROM)).toEqual(first);
  });

  it("keeps firing correctly across a DST transition day", () => {
    const from = instantAt("2024-11-03", 0, NEW_YORK.tz);
    const jobs = upcomingAlerts(NEW_YORK, CALC, DEFAULT_ALERTS, from, 26);
    assertWellFormed(jobs, from, 26);
    // The fall-back day is 25 hours long, so a 26-hour horizon still spans it.
    expect(jobs.length).toBeGreaterThanOrEqual(ALERTABLE.length);
    for (const job of jobs) {
      const [day] = job.dedupeKey.split(":");
      expect(instantsForDay(NEW_YORK, CALC, day).some(
        (i) => i.at.getTime() === job.prayerAt.getTime(),
      )).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GPS locations (tz: null)
// ---------------------------------------------------------------------------

describe("locations without an IANA zone (GPS)", () => {
  const GPS: Loc = {
    name: "Current location",
    country: "",
    lat: 45.5019,
    lng: -73.5674,
    tz: null,
    source: "gps",
  };

  it("runs the whole chain on the device clock", () => {
    for (const key of ["2024-01-15", "2024-06-21", "2024-12-21"]) {
      const instants = instantsForDay(GPS, CALC, key);
      expect(instants).toHaveLength(6);
      for (let i = 1; i < instants.length; i++) {
        expect(instants[i].at.getTime()).toBeGreaterThan(instants[i - 1].at.getTime());
      }
      for (const probe of hourlyProbes(GPS, key)) {
        const next = nextPrayerAfter(GPS, CALC, probe);
        const current = currentPrayerAt(GPS, CALC, probe);
        expect(next.at.getTime()).toBeGreaterThan(probe.getTime());
        expect(current).not.toBeNull();
        expect(current!.at.getTime()).toBeLessThanOrEqual(probe.getTime());
      }
      const from = instantAt(key, 9, null);
      const jobs = upcomingAlerts(GPS, CALC, DEFAULT_ALERTS, from, 26);
      assertWellFormed(jobs, from, 26);
      expect(new Set(jobs.map((j) => j.key)).size).toBe(ALERTABLE.length);
    }
  });

  it("agrees with the same location pinned to the device's own zone", () => {
    const device = deviceTimeZone();
    const pinned: Loc = { ...GPS, tz: device };
    for (const key of ["2024-01-15", "2024-06-21", "2024-09-10", "2024-12-21"]) {
      // Skip days on which the device zone changes offset: a prayer landing in
      // a spring-forward gap is resolved differently by the two code paths, and
      // which zone the runner is in is not something a test can control.
      const start = instantAt(key, 0, device);
      const end = new Date(start.getTime() + 24 * 3_600_000);
      if (tzOffsetHours(device, start) !== tzOffsetHours(device, end)) continue;

      const loose = instantsForDay(GPS, CALC, key);
      const strict = instantsForDay(pinned, CALC, key);
      expect(loose.map((i) => i.at.getTime()), key).toEqual(
        strict.map((i) => i.at.getTime()),
      );
      expect(dayKey(null, loose[0].at)).toBe(dayKey(device, strict[0].at));
    }
  });
});
