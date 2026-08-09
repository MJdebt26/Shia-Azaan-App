import {
  asrHourAngle,
  fixHour,
  horizonDip,
  hourAngle,
  hourDiff,
  julianDay,
  solarNoon,
  sunPosition,
} from "./astronomy";
import { METHODS } from "./methods";
import type {
  CalcSettings,
  HighLatRule,
  MethodDef,
  PrayerKey,
  Times,
} from "../types";

export interface ComputeInput {
  /** Calendar date whose Y/M/D are the *local* civil date at the location. */
  date: Date;
  lat: number;
  lng: number;
  /** UTC offset in hours for that local date (DST-aware). */
  tzOffset: number;
  elevation?: number;
  calc: CalcSettings;
}

/** Resolve the effective method definition, honouring custom angles. */
export function resolveMethod(calc: CalcSettings): MethodDef {
  const base = METHODS[calc.method] ?? METHODS.jafari_leva;
  if (calc.method !== "custom") {
    return { ...base, asrFactor: calc.asrFactor };
  }
  return {
    ...base,
    fajrAngle: calc.customFajrAngle,
    isha: { kind: "angle", angle: calc.customIshaAngle },
    asrFactor: calc.asrFactor,
  };
}

/**
 * Portion of the night that Fajr/Isha may be pushed away from sunrise/sunset
 * when the true angle is unreachable.
 *
 * - `middle_of_night` → half the night on each side
 * - `one_seventh`     → 1/7 of the night
 * - `angle_based`     → night/60 per degree (the widely used PrayTimes rule)
 */
function nightPortion(
  rule: HighLatRule,
  angle: number,
  nightLength: number,
): number {
  switch (rule) {
    case "middle_of_night":
      return nightLength / 2;
    case "one_seventh":
      return nightLength / 7;
    case "angle_based":
      return (angle / 60) * nightLength;
    default:
      return NaN;
  }
}

/**
 * Compute prayer times for one civil day.
 *
 * Returned values are fractional hours in the location's local time. They are
 * *not* wrapped to [0,24): Isha at a high latitude can legitimately land after
 * midnight, and callers need the ordering to stay monotonic.
 */
/**
 * Latitude beyond which the sun can stay entirely above or below the horizon.
 * Above this, if sunrise/sunset are themselves undefined we solve at this
 * latitude instead — the *Aqrab al-Bilād* ("nearest locality") solution.
 */
export const POLAR_FALLBACK_LAT = 48;

/** True when the sun neither rises nor sets on this date at this latitude. */
export function isPolarDay(input: Omit<ComputeInput, "calc">): boolean {
  const { date, lat, lng, elevation = 0 } = input;
  const jd =
    julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate()) -
    lng / (15 * 24);
  const { declination } = sunPosition(jd);
  return !Number.isFinite(hourAngle(horizonDip(elevation), declination, lat));
}

export function computeTimes(input: ComputeInput): Times {
  const { date, lng, tzOffset, elevation = 0, calc } = input;
  const method = resolveMethod(calc);

  // Under the midnight sun / polar night the sun never crosses the horizon, so
  // sunrise and sunset are undefined and every derived time collapses with
  // them. Solve the *angles* at the nearest latitude where a real day exists,
  // keeping this location's longitude and timezone.
  const polar = isPolarDay({ date, lat: input.lat, lng, tzOffset, elevation });
  const lat = polar
    ? Math.sign(input.lat || 1) * POLAR_FALLBACK_LAT
    : input.lat;

  // Julian day at the location's longitude, so the sun's position is sampled
  // for the correct instant rather than for Greenwich.
  const jdBase =
    julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate()) -
    lng / (15 * 24);

  // Convert an hour-of-day guess into a refined time, iterating because the
  // sun's declination itself depends on the time of day.
  const refine = (
    guessHours: number,
    solve: (declination: number, noon: number) => number,
  ): number => {
    let value = guessHours;
    for (let i = 0; i < 4; i++) {
      const jd = jdBase + value / 24;
      const { declination } = sunPosition(jd);
      const noon = solarNoon(jd);
      const next = solve(declination, noon);
      if (!Number.isFinite(next)) return NaN;
      if (Math.abs(next - value) < 1e-6) return next;
      value = next;
    }
    return value;
  };

  const dip = horizonDip(elevation);

  const dhuhr = refine(12, (_d, noon) => noon);
  const sunrise = refine(
    6,
    (d, noon) => noon - hourAngle(dip, d, lat),
  );
  const sunset = refine(18, (d, noon) => noon + hourAngle(dip, d, lat));
  const fajr = refine(
    5,
    (d, noon) => noon - hourAngle(method.fajrAngle, d, lat),
  );
  const asr = refine(
    13,
    (d, noon) => noon + asrHourAngle(method.asrFactor, d, lat),
  );

  let maghrib: number;
  switch (method.maghrib.kind) {
    case "sunset":
      maghrib = sunset;
      break;
    case "offset":
      maghrib = sunset + method.maghrib.minutes / 60;
      break;
    default:
      maghrib = refine(
        18.5,
        (d, noon) =>
          noon + hourAngle((method.maghrib as { angle: number }).angle, d, lat),
      );
  }

  let isha: number;
  if (method.isha.kind === "offset") {
    isha = maghrib + method.isha.minutes / 60;
  } else {
    const angle = method.isha.angle;
    isha = refine(19, (d, noon) => noon + hourAngle(angle, d, lat));
  }

  // Shift from apparent solar time at this longitude to civil clock time.
  const civilShift = tzOffset - lng / 15;
  const t: Record<PrayerKey | "sunset", number> = {
    fajr: fajr + civilShift,
    sunrise: sunrise + civilShift,
    dhuhr: dhuhr + civilShift,
    asr: asr + civilShift,
    sunset: sunset + civilShift,
    maghrib: maghrib + civilShift,
    isha: isha + civilShift,
  };

  // --- high-latitude corrections -------------------------------------------
  // The night runs from this sunset to the *next* sunrise; when the sun barely
  // sets, that span is short and the fallbacks pull Fajr/Isha inward.
  if (calc.highLatRule !== "none") {
    const night = hourDiff(t.sunset, t.sunrise);

    const fajrLimit = nightPortion(calc.highLatRule, method.fajrAngle, night);
    if (!Number.isFinite(t.fajr) || hourDiff(t.fajr, t.sunrise) > fajrLimit) {
      t.fajr = t.sunrise - fajrLimit;
    }

    if (method.isha.kind === "angle") {
      const ishaLimit = nightPortion(
        calc.highLatRule,
        method.isha.angle,
        night,
      );
      if (!Number.isFinite(t.isha) || hourDiff(t.sunset, t.isha) > ishaLimit) {
        t.isha = t.sunset + ishaLimit;
      }
    }

    if (method.maghrib.kind === "angle") {
      const maghribLimit = nightPortion(
        calc.highLatRule,
        method.maghrib.angle,
        night,
      );
      if (
        !Number.isFinite(t.maghrib) ||
        hourDiff(t.sunset, t.maghrib) > maghribLimit
      ) {
        t.maghrib = t.sunset + maghribLimit;
      }
    }
  }

  // Anything still unresolved (polar day/night with rule "none") falls back to
  // the sunrise/sunset pair so the UI always has a monotonic ordering.
  if (!Number.isFinite(t.fajr)) t.fajr = t.sunrise - 1.5;
  if (!Number.isFinite(t.maghrib)) t.maghrib = t.sunset;
  if (!Number.isFinite(t.isha)) t.isha = t.maghrib + 1.5;

  // --- derived markers ------------------------------------------------------
  const imsak = t.fajr - calc.imsakMinutes / 60;

  // Ja'fari midnight: midpoint of sunset → next Fajr. Sunni methods use
  // sunset → sunrise. `hourDiff` handles the wrap past 24h.
  const midnightSpan = method.jafari
    ? hourDiff(t.sunset, t.fajr)
    : hourDiff(t.sunset, t.sunrise);
  const midnight = t.sunset + midnightSpan / 2;

  // --- manual per-prayer adjustments ---------------------------------------
  const adj = calc.adjustments;
  const out: Times = {
    imsak: imsak + adj.fajr / 60,
    fajr: t.fajr + adj.fajr / 60,
    sunrise: t.sunrise + adj.sunrise / 60,
    dhuhr: t.dhuhr + adj.dhuhr / 60,
    asr: t.asr + adj.asr / 60,
    sunset: t.sunset + adj.maghrib / 60,
    maghrib: t.maghrib + adj.maghrib / 60,
    isha: t.isha + adj.isha / 60,
    midnight,
  };

  return out;
}

/** Wrap every value into [0,24) — for display only, never for ordering. */
export function wrapTimes(times: Times): Times {
  const out = {} as Times;
  for (const k of Object.keys(times) as (keyof Times)[]) {
    out[k] = fixHour(times[k]);
  }
  return out;
}
