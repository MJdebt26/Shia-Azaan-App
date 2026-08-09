import { describe, expect, it } from "vitest";

import {
  addDays,
  civilInZone,
  dateFromKey,
  dayKey,
  describeDuration,
  deviceTimeZone,
  formatDuration,
  formatTime,
  gregorianLabel,
  hijriLabel,
  instantAt,
  isValidTimeZone,
  localHours,
  tzOffsetHours,
} from "../lib/time";

/**
 * Timezone plumbing tests.
 *
 * Everything here is written against explicit IANA zones and explicit UTC
 * instants so the suite gives the same answers no matter what timezone the
 * machine running it happens to be in. The only exceptions are the deliberate
 * "no zone" fallbacks, which are compared against the device's own `Date`
 * methods rather than against hard-coded numbers.
 */

const utc = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// tzOffsetHours
// ---------------------------------------------------------------------------

describe("tzOffsetHours — DST boundaries", () => {
  it("flips America/New_York at the exact spring-forward instant", () => {
    // 2024-03-10 02:00 EST → 03:00 EDT, i.e. 07:00 UTC.
    expect(tzOffsetHours("America/New_York", utc("2024-03-09T12:00:00Z"))).toBe(-5);
    expect(tzOffsetHours("America/New_York", utc("2024-03-10T06:59:59Z"))).toBe(-5);
    expect(tzOffsetHours("America/New_York", utc("2024-03-10T07:00:00Z"))).toBe(-4);
    expect(tzOffsetHours("America/New_York", utc("2024-03-11T12:00:00Z"))).toBe(-4);
  });

  it("flips America/New_York back at the exact fall-back instant", () => {
    // 2024-11-03 02:00 EDT → 01:00 EST, i.e. 06:00 UTC.
    expect(tzOffsetHours("America/New_York", utc("2024-11-03T05:59:59Z"))).toBe(-4);
    expect(tzOffsetHours("America/New_York", utc("2024-11-03T06:00:00Z"))).toBe(-5);
  });

  it("flips Europe/London at 01:00 UTC in both directions", () => {
    expect(tzOffsetHours("Europe/London", utc("2024-03-31T00:59:59Z"))).toBe(0);
    expect(tzOffsetHours("Europe/London", utc("2024-03-31T01:00:00Z"))).toBe(1);
    expect(tzOffsetHours("Europe/London", utc("2024-10-27T00:59:59Z"))).toBe(1);
    expect(tzOffsetHours("Europe/London", utc("2024-10-27T01:00:00Z"))).toBe(0);
  });

  it("runs Australia/Sydney's DST the other way round", () => {
    // Southern hemisphere: DST covers the *December* solstice, not June.
    // Ends 2024-04-07 03:00 AEDT (= 2024-04-06 16:00 UTC).
    expect(tzOffsetHours("Australia/Sydney", utc("2024-04-06T15:59:59Z"))).toBe(11);
    expect(tzOffsetHours("Australia/Sydney", utc("2024-04-06T16:00:00Z"))).toBe(10);
    // Starts 2024-10-06 02:00 AEST (= 2024-10-05 16:00 UTC).
    expect(tzOffsetHours("Australia/Sydney", utc("2024-10-05T15:59:59Z"))).toBe(10);
    expect(tzOffsetHours("Australia/Sydney", utc("2024-10-05T16:00:00Z"))).toBe(11);

    const june = tzOffsetHours("Australia/Sydney", utc("2024-06-21T12:00:00Z"));
    const december = tzOffsetHours("Australia/Sydney", utc("2024-12-21T12:00:00Z"));
    expect(june).toBeLessThan(december);
    // ...the mirror image of the northern hemisphere.
    const nyJune = tzOffsetHours("America/New_York", utc("2024-06-21T12:00:00Z"));
    const nyDecember = tzOffsetHours("America/New_York", utc("2024-12-21T12:00:00Z"));
    expect(nyJune).toBeGreaterThan(nyDecember);
  });

  it("returns fractional offsets for half-hour and 45-minute zones", () => {
    for (const iso of [
      "2024-01-15T12:00:00Z",
      "2024-03-10T12:00:00Z",
      "2024-06-21T12:00:00Z",
      "2024-11-03T12:00:00Z",
    ]) {
      // Iran dropped DST in 2022, so Tehran is a flat +3:30 all year.
      expect(tzOffsetHours("Asia/Tehran", utc(iso))).toBe(3.5);
      expect(tzOffsetHours("Asia/Kolkata", utc(iso))).toBe(5.5);
      expect(tzOffsetHours("Asia/Kathmandu", utc(iso))).toBe(5.75);
    }
  });

  it("keeps UTC at zero and never returns a negative zero", () => {
    const off = tzOffsetHours("UTC", utc("2024-06-21T12:00:00Z"));
    expect(off).toBe(0);
    expect(Object.is(off, -0)).toBe(false);
  });

  it("falls back to the device offset for a null or bogus zone", () => {
    const instant = utc("2024-06-21T12:00:00Z");
    const deviceOffset = -instant.getTimezoneOffset() / 60;
    expect(tzOffsetHours(null, instant)).toBe(deviceOffset);
    expect(tzOffsetHours("Not/AZone", instant)).toBe(deviceOffset);
    expect(tzOffsetHours("", instant)).toBe(deviceOffset);
  });
});

describe("isValidTimeZone / deviceTimeZone", () => {
  it("accepts real zones and rejects everything else", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Tehran")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Nowhere/Land")).toBe(false);
  });

  it("reports a device zone that is itself usable", () => {
    expect(isValidTimeZone(deviceTimeZone())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// civilInZone / localHours
// ---------------------------------------------------------------------------

describe("civilInZone", () => {
  it("reads every field, including seconds", () => {
    expect(civilInZone(utc("2024-06-21T12:34:56Z"), "UTC")).toEqual({
      year: 2024,
      month: 6,
      day: 21,
      hour: 12,
      minute: 34,
      second: 56,
    });
  });

  it("reports midnight as hour 0, not 24", () => {
    expect(civilInZone(utc("2024-06-21T00:00:00Z"), "UTC").hour).toBe(0);
    // 00:00 in Tokyo (UTC+9) is 15:00 UTC the previous day.
    const tokyo = civilInZone(utc("2024-06-20T15:00:00Z"), "Asia/Tokyo");
    expect(tokyo.hour).toBe(0);
    expect(tokyo.day).toBe(21);
  });

  it("falls back to the device fields when no zone is given", () => {
    const instant = utc("2024-06-15T18:00:00Z");
    expect(civilInZone(instant, null)).toEqual({
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
      second: instant.getSeconds(),
    });
  });
});

describe("localHours", () => {
  it("returns fractional hours in a 45-minute zone", () => {
    expect(localHours("Asia/Kathmandu", utc("2024-06-20T23:45:00Z"))).toBeCloseTo(5.5, 10);
  });

  it("stays inside [0,24) across a whole day in every probed zone", () => {
    for (const tz of ["UTC", "America/New_York", "Asia/Kathmandu", "Australia/Sydney"]) {
      for (let m = 0; m < 1440; m += 17) {
        const h = localHours(tz, new Date(Date.UTC(2024, 2, 10, 0, m)));
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(24);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// instantAt
// ---------------------------------------------------------------------------

describe("instantAt — civil round-trips", () => {
  /** Requested wall clock must come back out of civilInZone unchanged. */
  const roundTrip = (key: string, hours: number, tz: string) => {
    const at = instantAt(key, hours, tz);
    const civil = civilInZone(at, tz);
    const [y, m, d] = key.split("-").map(Number);
    const wholeMinutes = Math.round(hours * 60);
    expect(
      {
        year: civil.year,
        month: civil.month,
        day: civil.day,
        hour: civil.hour,
        minute: civil.minute,
        second: civil.second,
      },
      `${tz} ${key} @${hours}`,
    ).toEqual({
      year: y,
      month: m,
      day: d,
      hour: Math.floor(wholeMinutes / 60),
      minute: wholeMinutes % 60,
      second: 0,
    });
  };

  it("round-trips ordinary times in whole, half and quarter-hour zones", () => {
    for (const tz of [
      "UTC",
      "America/New_York",
      "Europe/London",
      "Australia/Sydney",
      "Asia/Tehran",
      "Asia/Kolkata",
      "Asia/Kathmandu",
    ]) {
      for (const hours of [0, 0.25, 5.5, 12, 17 + 43 / 60, 23.5, 23 + 59 / 60]) {
        roundTrip("2024-06-21", hours, tz);
        roundTrip("2024-12-21", hours, tz);
      }
    }
  });

  it("round-trips on the spring-forward day outside the missing hour", () => {
    // The 02:00–03:00 hour does not exist in New York on 2024-03-10.
    for (const hours of [0, 1.5, 3.5, 6, 12, 20.25, 23.5]) {
      roundTrip("2024-03-10", hours, "America/New_York");
    }
    // London jumps 01:00 → 02:00 on 2024-03-31.
    for (const hours of [0, 0.5, 3, 12, 23.5]) {
      roundTrip("2024-03-31", hours, "Europe/London");
    }
    // Sydney jumps 02:00 → 03:00 on 2024-10-06 (southern spring).
    for (const hours of [0, 1.5, 4, 12, 23.5]) {
      roundTrip("2024-10-06", hours, "Australia/Sydney");
    }
  });

  it("round-trips on the fall-back day, including the repeated hour", () => {
    // 01:00–02:00 happens twice in New York on 2024-11-03.
    for (const hours of [0, 0.5, 1.5, 2.5, 12, 23 + 59 / 60]) {
      roundTrip("2024-11-03", hours, "America/New_York");
    }
    for (const hours of [0, 1.5, 12, 23.5]) {
      roundTrip("2024-10-27", hours, "Europe/London");
      roundTrip("2024-04-07", hours, "Australia/Sydney");
    }
  });

  it("resolves the ambiguous hour to the first (still-DST) occurrence", () => {
    const at = instantAt("2024-11-03", 1.5, "America/New_York");
    expect(at.toISOString()).toBe("2024-11-03T05:30:00.000Z");
    expect(tzOffsetHours("America/New_York", at)).toBe(-4);
    // The second occurrence is exactly one hour later and is *not* what we get.
    expect(tzOffsetHours("America/New_York", new Date(at.getTime() + 3_600_000))).toBe(-5);
  });

  it("keeps a non-existent wall clock within an hour of the request, and stable", () => {
    // Times inside a spring-forward gap cannot round-trip; they must still land
    // on a real instant no more than an hour away, and re-resolving the civil
    // time we actually got must be a fixed point (otherwise a scheduler that
    // re-reads its own output would drift by an hour every tick).
    const gaps: Array<[string, number, string]> = [
      ["2024-03-10", 2.5, "America/New_York"],
      ["2024-03-31", 1.5, "Europe/London"],
      ["2024-10-06", 2.5, "Australia/Sydney"],
    ];
    for (const [key, hours, tz] of gaps) {
      const at = instantAt(key, hours, tz);
      expect(Number.isFinite(at.getTime())).toBe(true);
      const civil = civilInZone(at, tz);
      expect(`${civil.year}-${civil.month}-${civil.day}`).toBe(
        key.split("-").map(Number).join("-"),
      );
      const gotHours = civil.hour + civil.minute / 60;
      expect(Math.abs(gotHours - hours)).toBeLessThanOrEqual(1);
      expect(instantAt(key, gotHours, tz).getTime()).toBe(at.getTime());
    }
  });

  it("advances monotonically minute by minute through a DST transition", () => {
    // Wall-clock 00:00 → 06:00 on the fall-back day covers a repeated hour;
    // absolute time must still never move backwards.
    let previous = -Infinity;
    for (let m = 0; m <= 360; m++) {
      const t = instantAt("2024-11-03", m / 60, "America/New_York").getTime();
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  it("uses the device clock when the zone is null", () => {
    const at = instantAt("2024-06-15", 5.5, null);
    expect(at.getFullYear()).toBe(2024);
    expect(at.getMonth()).toBe(5);
    expect(at.getDate()).toBe(15);
    expect(at.getHours()).toBe(5);
    expect(at.getMinutes()).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// dayKey / dateFromKey / addDays
// ---------------------------------------------------------------------------

describe("dayKey", () => {
  it("splits the civil day per zone, not per UTC day", () => {
    const instant = utc("2024-12-31T16:00:00Z");
    expect(dayKey("Asia/Tokyo", instant)).toBe("2025-01-01");
    expect(dayKey("UTC", instant)).toBe("2024-12-31");
    expect(dayKey("America/New_York", instant)).toBe("2024-12-31");
  });

  it("zero-pads month and day", () => {
    expect(dayKey("UTC", utc("2024-01-05T00:00:00Z"))).toBe("2024-01-05");
    expect(dayKey("UTC", utc("2024-02-29T23:59:59Z"))).toBe("2024-02-29");
  });

  it("round-trips through dateFromKey in the device zone", () => {
    for (const key of [
      "2024-01-01",
      "2024-02-29",
      "2024-03-10",
      "2024-11-03",
      "2024-12-31",
      "2025-06-15",
    ]) {
      expect(dayKey(null, dateFromKey(key))).toBe(key);
    }
  });
});

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2023-02-28", 1)).toBe("2023-03-01");
    expect(addDays("2100-02-28", 1)).toBe("2100-03-01"); // 2100 is not a leap year
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2024-01-01", -1)).toBe("2023-12-31");
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2024-04-30", 1)).toBe("2024-05-01");
  });

  it("counts a leap year as 366 days", () => {
    expect(addDays("2024-01-01", 365)).toBe("2024-12-31");
    expect(addDays("2024-01-01", 366)).toBe("2025-01-01");
    expect(addDays("2023-01-01", 365)).toBe("2024-01-01");
  });

  it("is the identity at zero and reversible for any shift", () => {
    for (const key of ["2024-02-28", "2024-12-31", "2024-03-10", "2024-11-03"]) {
      expect(addDays(key, 0)).toBe(key);
      for (const n of [1, -1, 7, -7, 30, -30, 200, -200]) {
        expect(addDays(addDays(key, n), -n)).toBe(key);
      }
    }
  });

  it("always emits a zero-padded key", () => {
    let key = "2023-12-20";
    for (let i = 0; i < 400; i++) {
      key = addDays(key, 1);
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(key).toBe("2025-01-23");
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe("formatTime", () => {
  it("formats the corner hours in 24-hour mode", () => {
    expect(formatTime(0, "24h")).toEqual({ time: "00:00", suffix: "" });
    expect(formatTime(12, "24h")).toEqual({ time: "12:00", suffix: "" });
    expect(formatTime(23 + 59 / 60, "24h")).toEqual({ time: "23:59", suffix: "" });
  });

  it("formats the corner hours in 12-hour mode", () => {
    expect(formatTime(0, "12h")).toEqual({ time: "12:00", suffix: "AM" });
    expect(formatTime(12, "12h")).toEqual({ time: "12:00", suffix: "PM" });
    expect(formatTime(23 + 59 / 60, "12h")).toEqual({ time: "11:59", suffix: "PM" });
    expect(formatTime(11 + 59 / 60, "12h")).toEqual({ time: "11:59", suffix: "AM" });
    expect(formatTime(13.5, "12h")).toEqual({ time: "1:30", suffix: "PM" });
    expect(formatTime(1.5, "12h")).toEqual({ time: "1:30", suffix: "AM" });
  });

  it("rolls the hour instead of printing :60", () => {
    // 12.999 h = 12:59:56, which rounds up to 13:00.
    expect(formatTime(12.999, "24h")).toEqual({ time: "13:00", suffix: "" });
    expect(formatTime(12.999, "12h")).toEqual({ time: "1:00", suffix: "PM" });
    // 11.999 h rounds across the AM/PM boundary.
    expect(formatTime(11.999, "12h")).toEqual({ time: "12:00", suffix: "PM" });
    // 23.999 h rounds past midnight and must wrap to 00:00, not 24:00.
    expect(formatTime(23.999, "24h")).toEqual({ time: "00:00", suffix: "" });
    expect(formatTime(23.999, "12h")).toEqual({ time: "12:00", suffix: "AM" });
  });

  it("never emits a minute outside 00–59 anywhere in the day", () => {
    for (let h = 0; h < 24; h += 0.001) {
      const { time, suffix } = formatTime(h, "24h");
      expect(time, `24h at ${h}`).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(suffix).toBe("");
      const twelve = formatTime(h, "12h");
      expect(twelve.time, `12h at ${h}`).toMatch(/^(1[0-2]|[1-9]):[0-5]\d$/);
      expect(twelve.suffix === "AM" || twelve.suffix === "PM").toBe(true);
    }
  });

  it("wraps values outside [0,24) instead of overflowing", () => {
    // Isha past midnight arrives here as 25.5 and must read as 01:30.
    expect(formatTime(25.5, "24h")).toEqual({ time: "01:30", suffix: "" });
    expect(formatTime(24, "24h")).toEqual({ time: "00:00", suffix: "" });
    expect(formatTime(48.75, "24h")).toEqual({ time: "00:45", suffix: "" });
    expect(formatTime(-0.5, "24h")).toEqual({ time: "23:30", suffix: "" });
    expect(formatTime(-0.5, "12h")).toEqual({ time: "11:30", suffix: "PM" });
  });

  it("shows a dash for missing or non-finite values", () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatTime(bad, "24h")).toEqual({ time: "—", suffix: "" });
      expect(formatTime(bad, "12h")).toEqual({ time: "—", suffix: "" });
    }
  });
});

describe("formatDuration", () => {
  it("collapses everything at or below zero to 'now'", () => {
    expect(formatDuration(0)).toBe("now");
    expect(formatDuration(0.4)).toBe("now");
    expect(formatDuration(-5)).toBe("now");
  });

  it("formats minutes and hours with a padded minute field", () => {
    expect(formatDuration(0.6)).toBe("1m");
    expect(formatDuration(1)).toBe("1m");
    expect(formatDuration(59)).toBe("59m");
    expect(formatDuration(59.5)).toBe("1h 00m");
    expect(formatDuration(60)).toBe("1h 00m");
    expect(formatDuration(61)).toBe("1h 01m");
    expect(formatDuration(119)).toBe("1h 59m");
    expect(formatDuration(1440)).toBe("24h 00m");
    expect(formatDuration(1441)).toBe("24h 01m");
  });

  it("never prints a 60-minute remainder", () => {
    for (let m = 0; m <= 2000; m += 0.25) {
      const out = formatDuration(m);
      expect(out, `at ${m}`).not.toMatch(/\b60m\b/);
    }
  });
});

describe("describeDuration", () => {
  it("pluralises and always mentions minutes when there is no hour", () => {
    expect(describeDuration(0)).toBe("0 minutes");
    expect(describeDuration(-5)).toBe("0 minutes");
    expect(describeDuration(1)).toBe("1 minute");
    expect(describeDuration(59)).toBe("59 minutes");
    expect(describeDuration(60)).toBe("1 hour");
    expect(describeDuration(61)).toBe("1 hour 1 minute");
    expect(describeDuration(120)).toBe("2 hours");
    expect(describeDuration(122)).toBe("2 hours 2 minutes");
    expect(describeDuration(1440)).toBe("24 hours");
    expect(describeDuration(1441)).toBe("24 hours 1 minute");
  });

  it("never returns an empty string", () => {
    for (let m = 0; m <= 1500; m += 7) {
      expect(describeDuration(m).length).toBeGreaterThan(0);
    }
  });
});

describe("hijriLabel", () => {
  it("returns a non-empty label ending in a single 'AH'", () => {
    const label = hijriLabel("2024-03-21");
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain("AH");
    expect(label).toMatch(/AH$/);
    expect(label.match(/AH/g)).toHaveLength(1);
    expect(label).toMatch(/\d/);
  });

  it("shifts by whole days, matching a shift of the Gregorian key", () => {
    // Format-independent: a +1 offset must read exactly like tomorrow's label.
    for (const key of ["2024-03-21", "2024-12-31", "2024-02-28"]) {
      expect(hijriLabel(key, 1)).toBe(hijriLabel(addDays(key, 1), 0));
      expect(hijriLabel(key, -2)).toBe(hijriLabel(addDays(key, -2), 0));
      expect(hijriLabel(key, 0)).toBe(hijriLabel(key));
    }
  });

  it("produces a different label for a different offset", () => {
    const base = hijriLabel("2024-03-21");
    expect(hijriLabel("2024-03-21", 1)).not.toBe(base);
    expect(hijriLabel("2024-03-21", -1)).not.toBe(base);
    // A month's worth of offset must change more than the day number.
    expect(hijriLabel("2024-03-21", 30)).not.toBe(base);
  });

  it("stays well-formed across a whole Gregorian year", () => {
    let key = "2024-01-01";
    for (let i = 0; i < 365; i++) {
      const label = hijriLabel(key);
      expect(label, key).toMatch(/AH$/);
      expect(label.match(/AH/g), key).toHaveLength(1);
      key = addDays(key, 1);
    }
  });
});

describe("gregorianLabel", () => {
  it("labels distinct days distinctly", () => {
    const a = gregorianLabel("2024-03-21");
    const b = gregorianLabel("2024-03-22");
    expect(a.length).toBeGreaterThan(4);
    expect(a).not.toBe(b);
    // The leap day must not fall over.
    expect(gregorianLabel("2024-02-29").length).toBeGreaterThan(4);
  });
});
