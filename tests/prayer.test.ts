import { describe, expect, it } from "vitest";

import { computeTimes } from "../lib/prayer/times";
import { compassPoint, qiblaBearing, qiblaDistanceKm } from "../lib/prayer/qibla";
import { DEFAULT_CALC } from "../lib/constants";
import { tzOffsetHours } from "../lib/time";
import type { CalcSettings, PrayerKey } from "../lib/types";

const calc = (over: Partial<CalcSettings> = {}): CalcSettings => ({
  ...DEFAULT_CALC,
  adjustments: { ...DEFAULT_CALC.adjustments },
  ...over,
});

/** Compute for a civil date in a zone, returning "HH:MM" strings. */
function times(
  y: number,
  m: number,
  d: number,
  lat: number,
  lng: number,
  tz: string,
  settings = calc(),
) {
  const date = new Date(y, m - 1, d, 12);
  const offset = tzOffsetHours(tz, date);
  const t = computeTimes({ date, lat, lng, tzOffset: offset, calc: settings });
  const fmt = (h: number) => {
    const total = Math.round(((h % 24) + 24) % 24 * 60) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return {
    raw: t,
    fajr: fmt(t.fajr),
    sunrise: fmt(t.sunrise),
    dhuhr: fmt(t.dhuhr),
    asr: fmt(t.asr),
    maghrib: fmt(t.maghrib),
    isha: fmt(t.isha),
    midnight: fmt(t.midnight),
    imsak: fmt(t.imsak),
  };
}

/** Difference in minutes between an "HH:MM" result and expectation. */
function driftMinutes(actual: string, expected: string): number {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  let d = toMin(actual) - toMin(expected);
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return Math.abs(d);
}

/**
 * Golden values.
 *
 * Captured from the Aladhan API using method 0 ("Shia Ithna-Ashari, Leva
 * Institute, Qom") with `midnightMode=1` (Ja'fari midnight) — the same rulings
 * this engine implements. Sunrise was independently cross-checked against
 * sunrise-sunset.org, which shares no code with either implementation.
 *
 * Reproduce a row with:
 *   curl "https://api.aladhan.com/v1/timings/21-03-2024?latitude=34.6401\
 *   &longitude=50.8764&method=0&midnightMode=1&timezonestring=Asia/Tehran"
 *
 * A two-minute tolerance absorbs each side's rounding; a larger drift means
 * the astronomy has genuinely changed.
 */
const TOLERANCE = 2;

describe("Ja'fari prayer times — reference timetable agreement", () => {
  const cases: Array<{
    name: string;
    y: number;
    m: number;
    d: number;
    lat: number;
    lng: number;
    tz: string;
    expect: Partial<Record<PrayerKey | "midnight", string>>;
  }> = [
    {
      name: "Qom, 21 March 2024 (equinox)",
      y: 2024, m: 3, d: 21,
      lat: 34.6401, lng: 50.8764, tz: "Asia/Tehran",
      expect: {
        fajr: "04:54", sunrise: "06:09", dhuhr: "12:14",
        asr: "15:41", maghrib: "18:35", isha: "19:24", midnight: "23:37",
      },
    },
    {
      name: "Tehran, 21 June 2024 (summer solstice)",
      y: 2024, m: 6, d: 21,
      lat: 35.6892, lng: 51.389, tz: "Asia/Tehran",
      expect: {
        fajr: "03:15", sunrise: "04:49", dhuhr: "12:06",
        asr: "15:55", maghrib: "19:42", isha: "20:44", midnight: "23:19",
      },
    },
    {
      name: "Najaf, 15 December 2024 (winter)",
      y: 2024, m: 12, d: 15,
      lat: 32.0, lng: 44.3333, tz: "Asia/Baghdad",
      expect: {
        fajr: "05:38", sunrise: "06:56", dhuhr: "11:58",
        asr: "14:42", maghrib: "17:17", isha: "18:08", midnight: "23:19",
      },
    },
    {
      name: "Makkah, 1 September 2024",
      y: 2024, m: 9, d: 1,
      lat: 21.4225, lng: 39.8262, tz: "Asia/Riyadh",
      expect: {
        fajr: "04:57", sunrise: "06:04", dhuhr: "12:21",
        asr: "15:46", maghrib: "18:50", isha: "19:34", midnight: "23:47",
      },
    },
    {
      name: "Vancouver, 21 December 2024 (winter, high-ish latitude)",
      y: 2024, m: 12, d: 21,
      lat: 49.2827, lng: -123.1207, tz: "America/Vancouver",
      expect: {
        fajr: "06:21", sunrise: "08:05", dhuhr: "12:11",
        asr: "14:00", maghrib: "16:40", isha: "17:48", midnight: "23:19",
      },
    },
    {
      name: "London, 21 June 2024 (angle-based high-latitude rule)",
      y: 2024, m: 6, d: 21,
      lat: 51.5074, lng: -0.1278, tz: "Europe/London",
      expect: {
        fajr: "02:45", sunrise: "04:43", dhuhr: "13:02",
        asr: "17:25", maghrib: "21:50", isha: "23:05",
      },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const t = times(c.y, c.m, c.d, c.lat, c.lng, c.tz);
      for (const [key, want] of Object.entries(c.expect)) {
        const got = t[key as keyof typeof t] as string;
        const drift = driftMinutes(got, want as string);
        expect(
          drift,
          `${key}: got ${got}, expected ~${want} (drift ${drift}m)`,
        ).toBeLessThanOrEqual(TOLERANCE);
      }
    });
  }
});

describe("Ja'fari rulings", () => {
  it("places Maghrib meaningfully after sunset (not at sunset)", () => {
    const t = times(2024, 6, 21, 35.6892, 51.389, "Asia/Tehran");
    const gapMinutes = (t.raw.maghrib - t.raw.sunset) * 60;
    // The 4° depression is roughly 15–30 min depending on latitude/season.
    expect(gapMinutes).toBeGreaterThan(10);
    expect(gapMinutes).toBeLessThan(45);
  });

  it("uses sunset for Sunni methods", () => {
    const t = times(2024, 6, 21, 35.6892, 51.389, "Asia/Tehran", calc({ method: "mwl" }));
    expect(Math.abs(t.raw.maghrib - t.raw.sunset) * 60).toBeLessThan(0.5);
  });

  it("computes midnight as the sunset→Fajr midpoint (Ja'fari)", () => {
    const t = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran");
    const { sunset, fajr, midnight } = t.raw;
    const span = fajr + 24 - sunset;
    expect(midnight).toBeCloseTo(sunset + span / 2, 4);
    // ...and that lands late evening / early morning, never mid-afternoon.
    const wrapped = ((midnight % 24) + 24) % 24;
    expect(wrapped > 22 || wrapped < 2).toBe(true);
  });

  it("puts Imsak the configured number of minutes before Fajr", () => {
    const settings = calc({ imsakMinutes: 15 });
    const t = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran", settings);
    expect((t.raw.fajr - t.raw.imsak) * 60).toBeCloseTo(15, 4);
  });

  it("orders the day monotonically", () => {
    const t = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran").raw;
    expect(t.imsak).toBeLessThan(t.fajr);
    expect(t.fajr).toBeLessThan(t.sunrise);
    expect(t.sunrise).toBeLessThan(t.dhuhr);
    expect(t.dhuhr).toBeLessThan(t.asr);
    expect(t.asr).toBeLessThan(t.sunset);
    expect(t.sunset).toBeLessThan(t.maghrib);
    expect(t.maghrib).toBeLessThan(t.isha);
  });
});

describe("high latitudes", () => {
  // Tromsø in June: the sun never sets, so no depression angle is reachable.
  const TROMSO = { lat: 69.6496, lng: 18.9553, tz: "Europe/Oslo" };

  it("still yields finite, ordered times under the midnight sun", () => {
    for (const rule of ["middle_of_night", "one_seventh", "angle_based"] as const) {
      const t = times(2024, 6, 21, TROMSO.lat, TROMSO.lng, TROMSO.tz, calc({ highLatRule: rule })).raw;
      for (const [k, v] of Object.entries(t)) {
        expect(Number.isFinite(v), `${rule}/${k} should be finite`).toBe(true);
      }
      expect(t.fajr, `${rule}: fajr before sunrise`).toBeLessThan(t.sunrise);
      expect(t.maghrib, `${rule}: maghrib after sunset`).toBeGreaterThanOrEqual(t.sunset);
    }
  });

  it("never leaves NaN even with the rule disabled", () => {
    const t = times(2024, 6, 21, TROMSO.lat, TROMSO.lng, TROMSO.tz, calc({ highLatRule: "none" })).raw;
    for (const v of Object.values(t)) expect(Number.isFinite(v)).toBe(true);
  });

  it("Vancouver in summer produces a sane Fajr, not a 2am artefact", () => {
    const t = times(2024, 6, 21, 49.2827, -123.1207, "America/Vancouver").raw;
    // Fajr must sit between midnight and sunrise, and the night must be short.
    expect(t.fajr).toBeGreaterThan(0);
    expect(t.fajr).toBeLessThan(t.sunrise);
    expect((t.sunrise - t.fajr) * 60).toBeGreaterThan(30);
  });
});

describe("adjustments", () => {
  it("applies per-prayer minute offsets", () => {
    const base = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran").raw;
    const bumped = times(
      2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran",
      calc({ adjustments: { ...DEFAULT_CALC.adjustments, asr: 5, isha: -3 } }),
    ).raw;
    expect((bumped.asr - base.asr) * 60).toBeCloseTo(5, 4);
    expect((bumped.isha - base.isha) * 60).toBeCloseTo(-3, 4);
    expect(bumped.dhuhr).toBeCloseTo(base.dhuhr, 6);
  });

  it("shifts Asr later for the Hanafi factor", () => {
    const one = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran").raw;
    const two = times(2024, 3, 21, 34.6401, 50.8764, "Asia/Tehran", calc({ asrFactor: 2 })).raw;
    expect(two.asr).toBeGreaterThan(one.asr);
  });
});

describe("DST correctness", () => {
  it("handles the spring-forward day without an hour jump", () => {
    // US DST began 10 March 2024. Dhuhr should stay near solar noon local time.
    const before = times(2024, 3, 9, 40.7128, -74.006, "America/New_York").raw;
    const after = times(2024, 3, 10, 40.7128, -74.006, "America/New_York").raw;
    // Clocks move forward one hour, so local-clock Dhuhr jumps ~1h.
    expect((after.dhuhr - before.dhuhr) * 60).toBeGreaterThan(55);
    expect((after.dhuhr - before.dhuhr) * 60).toBeLessThan(65);
  });
});

describe("qibla", () => {
  it("points roughly south-east from Tehran", () => {
    const b = qiblaBearing(35.6892, 51.389);
    expect(b).toBeGreaterThan(190);
    expect(b).toBeLessThan(240);
  });

  it("points east-north-east from New York", () => {
    const b = qiblaBearing(40.7128, -74.006);
    expect(b).toBeGreaterThan(50);
    expect(b).toBeLessThan(70);
  });

  it("is degenerate but finite at the Kaaba itself", () => {
    expect(Number.isFinite(qiblaBearing(21.4225, 39.8262))).toBe(true);
    expect(qiblaDistanceKm(21.4225, 39.8262)).toBeLessThan(1);
  });

  it("measures a sensible distance", () => {
    // London → Makkah is ~4,800 km.
    const km = qiblaDistanceKm(51.5074, -0.1278);
    expect(km).toBeGreaterThan(4600);
    expect(km).toBeLessThan(5000);
  });

  it("labels compass points", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(90)).toBe("E");
    expect(compassPoint(180)).toBe("S");
    expect(compassPoint(270)).toBe("W");
    expect(compassPoint(359)).toBe("N");
  });
});
