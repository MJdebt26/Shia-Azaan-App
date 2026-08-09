/**
 * Solar astronomy primitives.
 *
 * Low-precision solar position from the *Astronomical Almanac* ("Approximate
 * Solar Coordinates"), accurate to ~0.01° over 1950–2050 — far finer than the
 * one-minute resolution a timetable is displayed at.
 *
 * Everything here is pure and angle-in-degrees. No dates, no timezones, no
 * fiqh: those live in `times.ts`.
 */

// --- degree-based trig ------------------------------------------------------

export const dtr = (d: number): number => (d * Math.PI) / 180;
export const rtd = (r: number): number => (r * 180) / Math.PI;

export const dsin = (d: number): number => Math.sin(dtr(d));
export const dcos = (d: number): number => Math.cos(dtr(d));
export const dtan = (d: number): number => Math.tan(dtr(d));
export const dasin = (x: number): number => rtd(Math.asin(x));
export const dacos = (x: number): number => rtd(Math.acos(x));
export const datan2 = (y: number, x: number): number => rtd(Math.atan2(y, x));
/** arccot, returned in [0,180). */
export const dacot = (x: number): number => rtd(Math.atan2(1, x));

/** Wrap to [0,360). */
export const fixAngle = (a: number): number => {
  const r = a - 360 * Math.floor(a / 360);
  return r < 0 ? r + 360 : r;
};

/** Wrap to [0,24). */
export const fixHour = (h: number): number => {
  const r = h - 24 * Math.floor(h / 24);
  return r < 0 ? r + 24 : r;
};

/** Forward difference b − a wrapped into [0,24). */
export const hourDiff = (a: number, b: number): number => fixHour(b - a);

// --- calendar ---------------------------------------------------------------

/**
 * Julian Day Number at 00:00 UT for a Gregorian calendar date.
 * `month` is 1-based.
 */
export function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
}

// --- solar position ---------------------------------------------------------

export interface SunPosition {
  /** Declination of the sun, degrees. */
  declination: number;
  /** Equation of time, hours (apparent − mean solar time). */
  equationOfTime: number;
}

/** Sun declination and equation of time for a Julian Day. */
export function sunPosition(jd: number): SunPosition {
  const d = jd - 2451545.0; // days since J2000.0
  const meanAnomaly = fixAngle(357.529 + 0.98560028 * d);
  const meanLongitude = fixAngle(280.459 + 0.98564736 * d);
  const eclipticLongitude = fixAngle(
    meanLongitude + 1.915 * dsin(meanAnomaly) + 0.02 * dsin(2 * meanAnomaly),
  );
  const obliquity = 23.439 - 0.00000036 * d;

  const rightAscension =
    datan2(dcos(obliquity) * dsin(eclipticLongitude), dcos(eclipticLongitude)) /
    15;

  return {
    declination: dasin(dsin(obliquity) * dsin(eclipticLongitude)),
    equationOfTime: meanLongitude / 15 - fixHour(rightAscension),
  };
}

/** Local solar noon (in hours, before timezone correction) for a Julian Day. */
export function solarNoon(jd: number): number {
  return fixHour(12 - sunPosition(jd).equationOfTime);
}

/**
 * Hour angle, in hours, between solar noon and the moment the sun sits
 * `angle` degrees **below** the horizon.
 *
 * Returns `NaN` when the sun never reaches that depression at this latitude
 * and date — the caller decides which high-latitude rule to apply.
 */
export function hourAngle(angle: number, declination: number, lat: number): number {
  const numerator = -dsin(angle) - dsin(declination) * dsin(lat);
  const denominator = dcos(declination) * dcos(lat);
  const cosH = numerator / denominator;
  if (cosH > 1 || cosH < -1) return NaN;
  return dacos(cosH) / 15;
}

/**
 * Hour angle for the moment an object's shadow reaches `factor` times its
 * own length plus its noon shadow — the classical Asr definition.
 */
export function asrHourAngle(
  factor: number,
  declination: number,
  lat: number,
): number {
  const angle = -dacot(factor + dtan(Math.abs(lat - declination)));
  return hourAngle(angle, declination, lat);
}

/**
 * Atmospheric-refraction + solar-radius correction for sunrise/sunset, in
 * degrees below the true horizon. Elevation lowers the visible horizon.
 */
export function horizonDip(elevationMetres = 0): number {
  const base = 0.833;
  if (!elevationMetres || elevationMetres <= 0) return base;
  return base + 0.0347 * Math.sqrt(elevationMetres);
}

/** Sun altitude in degrees for a given hour angle (hours from solar noon). */
export function sunAltitude(
  declination: number,
  lat: number,
  hoursFromNoon: number,
): number {
  const h = 15 * hoursFromNoon;
  return dasin(
    dsin(declination) * dsin(lat) + dcos(declination) * dcos(lat) * dcos(h),
  );
}
