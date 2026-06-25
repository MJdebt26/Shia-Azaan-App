import type { Times } from "./types";

export type Phase =
  | "night"
  | "predawn"
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "dusk"
  | "evening";

/** Three-stop vertical gradient (top → mid → bottom) for each solar phase. */
const PALETTE: Record<Phase, [string, string, string]> = {
  night: ["#070B20", "#0E1430", "#161D40"],
  predawn: ["#0E1233", "#241B40", "#3E2C4E"],
  dawn: ["#241B47", "#6B4560", "#D98E5E"],
  morning: ["#1C2E55", "#37598C", "#6E94BD"],
  midday: ["#1E3566", "#34589A", "#5E86B5"],
  afternoon: ["#22305E", "#54508C", "#C98A5C"],
  dusk: ["#1E1A40", "#7A3F52", "#E08A4A"],
  evening: ["#0C1030", "#1A1F46", "#262C5E"],
};

export function skyPhase(now: number, t: Times): Phase {
  const { fajr: f, sunrise: sr, dhuhr: dh, sunset: ss, maghrib: mg, isha: ish } = t;
  if (now < f - 0.5 || now >= ish + 1) return "night";
  if (now < sr) return "predawn";
  if (now < sr + 1.2) return "dawn";
  if (now < dh - 1) return "morning";
  if (now < dh + 2.5) return "midday";
  if (now < ss - 0.7) return "afternoon";
  if (now < mg + 0.4) return "dusk";
  return "evening";
}

export function skyColors(phase: Phase): [string, string, string] {
  return PALETTE[phase];
}

export function starsVisible(phase: Phase): boolean {
  return phase === "night" || phase === "predawn" || phase === "evening";
}

export function greeting(now: number, t: Times): string {
  const g =
    now < t.sunrise
      ? "Dawn is near"
      : now < 11
        ? "Good morning"
        : now < t.dhuhr + 3
          ? "Good afternoon"
          : now < t.sunset
            ? "Good afternoon"
            : "Good evening";
  return `${g} — peace be upon you`;
}
