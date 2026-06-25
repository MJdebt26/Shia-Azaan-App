import type { MethodDef, MethodKey, Times } from "./types";

/**
 * Ja'fari (Shia) prayer-time astronomy.
 *
 * Ported verbatim from the validated reference implementation — the numbers
 * were checked against published times for Mecca, Najaf, Tehran, London and
 * Vancouver across summer and winter before this app was built. Two methods
 * are supported:
 *
 *  - "leva":   Ja'fari / Leva Institute, Qom (Fajr 16°, Isha 14°, Maghrib 4°
 *              below the horizon — NOT at sunset, which is the Shia ruling).
 *  - "tehran": Institute of Geophysics, University of Tehran.
 *
 * Imsak is Fajr − 10 min. Islamic Midnight (Nisf al-Layl, Jafari) is the
 * midpoint between sunset and the following Fajr. A half-night fallback keeps
 * Fajr/Isha/Maghrib sane at high latitudes where the sun never reaches the
 * required depression angle (e.g. Vancouver in summer).
 */

// --- angle helpers (degrees) ---
const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;
const dsin = (d: number) => Math.sin(dtr(d));
const dcos = (d: number) => Math.cos(dtr(d));
const dtan = (d: number) => Math.tan(dtr(d));
const dasin = (x: number) => rtd(Math.asin(x));
const dacos = (x: number) => rtd(Math.acos(x));
const datan2 = (y: number, x: number) => rtd(Math.atan2(y, x));
const dacot = (x: number) => rtd(Math.atan2(1, x));

const fixA = (a: number) => {
  a -= 360 * Math.floor(a / 360);
  return a < 0 ? a + 360 : a;
};
const fixH = (h: number) => {
  h -= 24 * Math.floor(h / 24);
  return h < 0 ? h + 24 : h;
};
const tdiff = (a: number, b: number) => fixH(b - a);

function julian(y: number, m: number, d: number): number {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    B -
    1524.5
  );
}

interface SunPos {
  decl: number;
  eqt: number;
}

function sun(jd: number): SunPos {
  const D = jd - 2451545.0;
  const g = fixA(357.529 + 0.98560028 * D);
  const q = fixA(280.459 + 0.98564736 * D);
  const L = fixA(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = datan2(dcos(e) * dsin(L), dcos(L)) / 15;
  return { decl: dasin(dsin(e) * dsin(L)), eqt: q / 15 - fixH(RA) };
}

export const METHODS: Record<MethodKey, MethodDef> = {
  leva: {
    fajr: 16,
    isha: 14,
    maghrib: 4,
    asr: 1,
    label: "Ja'fari · Leva Institute, Qom",
  },
  tehran: {
    fajr: 17.7,
    isha: 14,
    maghrib: 4.5,
    asr: 1,
    label: "Institute of Geophysics, Tehran",
  },
};

/**
 * Compute prayer times for a calendar date at a given coordinate.
 * @param date  A Date whose Y/M/D fields are the local calendar day.
 * @param lat   Latitude in degrees.
 * @param lng   Longitude in degrees.
 * @param tz    UTC offset in hours for that day at that place.
 * @param methodKey  Calculation method.
 * @returns Times in fractional local hours.
 */
export function compute(
  date: Date,
  lat: number,
  lng: number,
  tz: number,
  methodKey: MethodKey,
): Times {
  const M = METHODS[methodKey] || METHODS.leva;
  const rs = 0.833; // sunrise/sunset refraction + solar radius
  const jDate =
    julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) -
    lng / (15 * 24);

  const mid = (t: number) => fixH(12 - sun(jDate + t).eqt);
  const fallback: Record<string, number> = {
    fajr: 5,
    sunrise: 6,
    dhuhr: 12,
    asr: 13,
    sunset: 18,
    maghrib: 18,
    isha: 18,
  };

  function angTime(angle: number, t: number, dir: "ccw" | "cw"): number {
    const decl = sun(jDate + t).decl;
    const x =
      (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
    if (x > 1 || x < -1) return NaN;
    const T = dacos(x) / 15;
    return mid(t) + (dir === "ccw" ? -T : T);
  }
  function asrTime(f: number, t: number): number {
    const decl = sun(jDate + t).decl;
    return angTime(-dacot(f + dtan(Math.abs(lat - decl))), t, "cw");
  }

  let g: Record<string, number> = {
    fajr: 5 / 24,
    sunrise: 6 / 24,
    dhuhr: 12 / 24,
    asr: 13 / 24,
    sunset: 18 / 24,
    maghrib: 18 / 24,
    isha: 18 / 24,
  };
  for (let i = 0; i < 3; i++) {
    g = {
      fajr: angTime(M.fajr, g.fajr, "ccw") / 24,
      sunrise: angTime(rs, g.sunrise, "ccw") / 24,
      dhuhr: mid(g.dhuhr) / 24,
      asr: asrTime(M.asr, g.asr) / 24,
      sunset: angTime(rs, g.sunset, "cw") / 24,
      maghrib: angTime(M.maghrib, g.maghrib, "cw") / 24,
      isha: angTime(M.isha, g.isha, "cw") / 24,
    };
    for (const k in g) if (isNaN(g[k])) g[k] = fallback[k] / 24;
  }

  const o: Record<string, number> = {
    fajr: g.fajr * 24,
    sunrise: g.sunrise * 24,
    dhuhr: g.dhuhr * 24,
    asr: g.asr * 24,
    sunset: g.sunset * 24,
    maghrib: g.maghrib * 24,
    isha: g.isha * 24,
  };
  const adj = tz - lng / 15;
  for (const k in o) o[k] += adj;

  // High-latitude: night-portion (half-night) fallback when the sun never
  // reaches the depression angle for Fajr / Isha / Maghrib.
  const night = tdiff(o.sunset, o.sunrise);
  const half = () => night / 2;
  const pf = half();
  if (isNaN(o.fajr) || tdiff(o.fajr, o.sunrise) > pf) o.fajr = o.sunrise - pf;
  const pi = half();
  if (isNaN(o.isha) || tdiff(o.sunset, o.isha) > pi) o.isha = o.sunset + pi;
  const pm = half();
  if (isNaN(o.maghrib) || tdiff(o.sunset, o.maghrib) > pm)
    o.maghrib = o.sunset + pm;

  o.imsak = o.fajr - 10 / 60;
  o.midnight = o.sunset + tdiff(o.sunset, o.fajr) / 2;
  for (const k in o) o[k] = fixH(o[k]);

  return o as Times;
}

/** Sun altitude in degrees at fractional local hour `h` on a given date. */
export function altitude(
  date: Date,
  lat: number,
  lng: number,
  tz: number,
  h: number,
): number {
  const jDate =
    julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) -
    lng / (15 * 24);
  const s = sun(jDate + h / 24);
  const noon = fixH(12 - s.eqt) + (tz - lng / 15);
  const H = 15 * (h - noon);
  return dasin(dsin(s.decl) * dsin(lat) + dcos(s.decl) * dcos(lat) * dcos(H));
}

/** Great-circle initial bearing from a point to the Kaaba, in degrees [0,360). */
export function qibla(lat: number, lng: number): number {
  const KLAT = 21.4225;
  const KLNG = 39.8262;
  const dL = dtr(KLNG - lng);
  const y = Math.sin(dL);
  const x =
    dcos(lat) * Math.tan(dtr(KLAT)) - dsin(lat) * Math.cos(dL);
  return (rtd(Math.atan2(y, x)) + 360) % 360;
}
