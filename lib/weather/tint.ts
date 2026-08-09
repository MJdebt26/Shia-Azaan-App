import type { SkyPhase } from "@/lib/sky";
import type { WeatherKind } from "./types";

/**
 * Weather → sky tint.
 *
 * The solar phase decides the *hue* of the sky (that is astronomy, and it is
 * already correct). Weather decides how much of that hue survives: an overcast
 * afternoon in Vancouver is the same sun as a clear one, seen through grey.
 *
 * So rather than a second palette that would fight the first, this desaturates
 * and darkens the phase colours toward a neutral, and blends by an amount that
 * depends on the conditions. Clear weather blends by zero and the astronomy
 * shows through untouched.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b))
    .toString(16)
    .padStart(6, "0")}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/**
 * How strongly each condition greys the sky, and toward which grey. Daytime
 * overcast goes toward a pale slate; storms go toward a dark one, which is what
 * makes a thunderstorm read as menacing rather than merely dim.
 */
interface TintSpec {
  /** 0 = untouched astronomy, 1 = fully the target grey. */
  amount: number;
  /** Target colour, as a hex string. */
  toward: string;
  /** Extra multiplicative darkening applied after the blend. */
  darken: number;
}

const TINTS: Readonly<Record<WeatherKind, TintSpec>> = {
  clear: { amount: 0, toward: "#000000", darken: 1 },
  cloudy: { amount: 0.16, toward: "#8792A8", darken: 0.98 },
  overcast: { amount: 0.42, toward: "#79839A", darken: 0.9 },
  fog: { amount: 0.55, toward: "#9AA3B2", darken: 0.94 },
  drizzle: { amount: 0.4, toward: "#6E7A8E", darken: 0.88 },
  rain: { amount: 0.48, toward: "#5E6A80", darken: 0.82 },
  sleet: { amount: 0.5, toward: "#6C7789", darken: 0.85 },
  snow: { amount: 0.44, toward: "#A8B2C4", darken: 0.95 },
  hail: { amount: 0.5, toward: "#69748A", darken: 0.84 },
  thunderstorm: { amount: 0.56, toward: "#3C4459", darken: 0.7 },
};

/** Night skies are already dark; greying them as hard as a noon sky reads wrong. */
const NIGHT_PHASES: ReadonlySet<SkyPhase> = new Set<SkyPhase>([
  "night",
  "predawn",
  "evening",
]);

/**
 * Apply a weather tint to one phase colour.
 *
 * @param hex     the astronomical colour for this phase
 * @param kind    current conditions
 * @param phase   solar phase, used to soften the effect at night
 */
export function tintColor(
  hex: string,
  kind: WeatherKind,
  phase: SkyPhase,
): string {
  const spec = TINTS[kind];
  // Normalise even the passthrough: callers memoise on and compare these
  // strings, so "#2F5EA6" and "#2f5ea6" must never both be reachable.
  if (!spec || spec.amount === 0) return rgbToHex(hexToRgb(hex));

  // At night the sky is dark whatever the weather, so a heavy grey blend just
  // makes it muddy. Halve it, and skip the darkening entirely.
  const nocturnal = NIGHT_PHASES.has(phase);
  const amount = nocturnal ? spec.amount * 0.45 : spec.amount;
  const darken = nocturnal ? 1 : spec.darken;

  const blended = mix(hexToRgb(hex), hexToRgb(spec.toward), amount);
  return rgbToHex({
    r: blended.r * darken,
    g: blended.g * darken,
    b: blended.b * darken,
  });
}

/** Tint a whole three-stop gradient. */
export function tintSky(
  colors: readonly [string, string, string],
  kind: WeatherKind,
  phase: SkyPhase,
): [string, string, string] {
  return [
    tintColor(colors[0], kind, phase),
    tintColor(colors[1], kind, phase),
    tintColor(colors[2], kind, phase),
  ];
}

/**
 * Stars are hidden by cloud. Returns how much of the star field survives, which
 * the hero multiplies into its opacity — so a clear night is full of stars, an
 * overcast one has none, and "partly cloudy" is genuinely partial.
 */
export function starVisibility(kind: WeatherKind, cloudCover: number): number {
  if (kind === "clear") return 1;
  if (kind === "cloudy") return Math.max(0, 1 - cloudCover / 100) * 0.9 + 0.1;
  if (kind === "fog") return 0;
  if (kind === "overcast") return 0.04;
  return 0; // any precipitation
}
