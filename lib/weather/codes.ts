import type { Intensity, WeatherKind } from "./types";

/**
 * WMO 4677 present-weather code → our vocabulary.
 *
 * Open-Meteo (and most European providers) report this standard set. Mapping it
 * exhaustively here — rather than with a few `if (code > 60)` guesses — is what
 * lets the renderer be confident: every code either has a deliberate visual or
 * is explicitly treated as "clear".
 *
 * Reference: WMO code table 4677, as published in Open-Meteo's docs.
 */

interface CodeEntry {
  kind: WeatherKind;
  intensity: Intensity;
  label: string;
}

const CODES: Readonly<Record<number, CodeEntry>> = {
  0: { kind: "clear", intensity: "light", label: "Clear sky" },
  1: { kind: "clear", intensity: "light", label: "Mainly clear" },
  2: { kind: "cloudy", intensity: "light", label: "Partly cloudy" },
  3: { kind: "overcast", intensity: "moderate", label: "Overcast" },

  45: { kind: "fog", intensity: "moderate", label: "Fog" },
  48: { kind: "fog", intensity: "heavy", label: "Freezing fog" },

  51: { kind: "drizzle", intensity: "light", label: "Light drizzle" },
  53: { kind: "drizzle", intensity: "moderate", label: "Drizzle" },
  55: { kind: "drizzle", intensity: "heavy", label: "Heavy drizzle" },
  56: { kind: "sleet", intensity: "light", label: "Freezing drizzle" },
  57: { kind: "sleet", intensity: "heavy", label: "Freezing drizzle" },

  61: { kind: "rain", intensity: "light", label: "Light rain" },
  63: { kind: "rain", intensity: "moderate", label: "Rain" },
  65: { kind: "rain", intensity: "heavy", label: "Heavy rain" },
  66: { kind: "sleet", intensity: "light", label: "Freezing rain" },
  67: { kind: "sleet", intensity: "heavy", label: "Freezing rain" },

  71: { kind: "snow", intensity: "light", label: "Light snow" },
  73: { kind: "snow", intensity: "moderate", label: "Snow" },
  75: { kind: "snow", intensity: "heavy", label: "Heavy snow" },
  77: { kind: "snow", intensity: "light", label: "Snow grains" },

  80: { kind: "rain", intensity: "light", label: "Light showers" },
  81: { kind: "rain", intensity: "moderate", label: "Showers" },
  82: { kind: "rain", intensity: "heavy", label: "Violent showers" },
  85: { kind: "snow", intensity: "light", label: "Snow showers" },
  86: { kind: "snow", intensity: "heavy", label: "Heavy snow showers" },

  95: { kind: "thunderstorm", intensity: "moderate", label: "Thunderstorm" },
  96: { kind: "thunderstorm", intensity: "moderate", label: "Thunderstorm with hail" },
  99: { kind: "thunderstorm", intensity: "heavy", label: "Severe thunderstorm" },
};

/** Used for unknown codes: show nothing rather than invent weather. */
const UNKNOWN: CodeEntry = {
  kind: "clear",
  intensity: "light",
  label: "Unknown",
};

/**
 * Translate a WMO code. Unknown or malformed codes fall back to "clear" — a
 * missing effect is a far smaller error than rendering a blizzard in Najaf
 * because a provider added a code we had never seen.
 */
export function decodeWmo(code: unknown): CodeEntry {
  if (typeof code !== "number" || !Number.isFinite(code)) return UNKNOWN;
  return CODES[Math.trunc(code)] ?? UNKNOWN;
}

/**
 * Heavy cloud with no precipitation still deserves a duller sky, so cloud cover
 * can promote "clear" to "cloudy"/"overcast". Codes 0–3 already encode this,
 * but providers are not always consistent, and the gradient reads wrong when
 * they disagree.
 */
export function refineByCloudCover(
  kind: WeatherKind,
  cloudCover: number,
): WeatherKind {
  if (kind !== "clear" && kind !== "cloudy") return kind;
  if (!Number.isFinite(cloudCover)) return kind;
  if (cloudCover >= 85) return "overcast";
  if (cloudCover >= 40) return "cloudy";
  return kind === "cloudy" && cloudCover < 20 ? "clear" : kind;
}
