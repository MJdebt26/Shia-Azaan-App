/**
 * Weather domain types.
 *
 * Deliberately provider-agnostic: `lib/weather/codes.ts` translates whatever a
 * provider returns into this vocabulary, and everything downstream — the
 * particle renderer, the sky tint, the labels — speaks only this. Swapping
 * providers should touch one file.
 */

/** What the sky is *doing*, at the granularity the visuals actually care about. */
export type WeatherKind =
  | "clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "sleet"
  | "snow"
  | "hail"
  | "thunderstorm";

export type Intensity = "light" | "moderate" | "heavy";

export interface WeatherSnapshot {
  kind: WeatherKind;
  intensity: Intensity;
  /** Provider's raw code, kept so a surprising render can be traced back. */
  code: number;
  /** Short human label, e.g. "Heavy rain". */
  label: string;
  temperatureC: number;
  /** Kilometres per hour. Drives how far precipitation slants. */
  windKph: number;
  /** 0–100. Drives cloud density and how much the sky is dulled. */
  cloudCover: number;
  /**
   * The provider's own day/night flag. We do NOT use this to pick the palette
   * — prayer times already give us a far better solar phase — but it is useful
   * for choosing cloud lighting.
   */
  isDay: boolean;
  /** When the reading was taken, ms since epoch. */
  observedAt: number;
}

/** Everything the UI needs, including the states where there is no reading. */
export interface WeatherState {
  data: WeatherSnapshot | null;
  loading: boolean;
  /** A short, user-facing sentence. Null when nothing has gone wrong. */
  error: string | null;
  /** True when `data` came from cache and may be out of date. */
  stale: boolean;
}

/** True when this kind puts particles on the screen. */
export function hasPrecipitation(kind: WeatherKind): boolean {
  return (
    kind === "drizzle" ||
    kind === "rain" ||
    kind === "sleet" ||
    kind === "snow" ||
    kind === "hail" ||
    kind === "thunderstorm"
  );
}
