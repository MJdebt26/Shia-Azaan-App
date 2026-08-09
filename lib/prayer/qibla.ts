import { dcos, dsin, dtr, rtd } from "./astronomy";

/** Coordinates of the Kaaba. */
export const KAABA = { lat: 21.4225, lng: 39.8262 } as const;

/**
 * Initial great-circle bearing from a point to the Kaaba, in degrees
 * clockwise from true north, in [0,360).
 */
export function qiblaBearing(lat: number, lng: number): number {
  const dLng = dtr(KAABA.lng - lng);
  const y = Math.sin(dLng);
  const x = dcos(lat) * Math.tan(dtr(KAABA.lat)) - dsin(lat) * Math.cos(dLng);
  return (rtd(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance to the Kaaba in kilometres. */
export function qiblaDistanceKm(lat: number, lng: number): number {
  const R = 6371;
  const dLat = dtr(KAABA.lat - lat);
  const dLng = dtr(KAABA.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    dcos(lat) * dcos(KAABA.lat) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

/** 16-point compass label for a bearing. */
export function compassPoint(bearing: number): string {
  return COMPASS[Math.round(((bearing % 360) + 360) % 360 / 22.5) % 16];
}
