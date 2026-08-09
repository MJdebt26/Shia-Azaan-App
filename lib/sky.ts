import type { Times } from "./types";

/**
 * Solar phase → palette.
 *
 * The hero gradient tracks the real position of the sun for the user's own
 * coordinates, so the app looks like the sky outside their window. Phases are
 * derived from the computed times rather than from clock hours, which keeps it
 * correct at high latitudes and across seasons.
 */

export type SkyPhase =
  | "night"
  | "predawn"
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "dusk"
  | "evening";

/** Vertical three-stop gradient (top → middle → horizon) per phase. */
const PALETTE: Record<SkyPhase, readonly [string, string, string]> = {
  night: ["#05081A", "#0B1128", "#131A3C"],
  predawn: ["#0B1030", "#22193E", "#3D2B4D"],
  dawn: ["#231A46", "#6B4560", "#D98E5E"],
  morning: ["#17284D", "#33538A", "#79A0C4"],
  midday: ["#183768", "#2F5EA6", "#6E9CC9"],
  afternoon: ["#1F2E5E", "#54508C", "#C98A5C"],
  dusk: ["#1B1740", "#7A3F52", "#E08A4A"],
  evening: ["#0A0E2C", "#171C42", "#232858"],
};

/**
 * Classify the moment `now` (fractional local hours) against the day's times.
 * Boundaries are expressed as offsets from real solar events.
 */
export function skyPhase(now: number, t: Times): SkyPhase {
  const { fajr, sunrise, dhuhr, sunset, maghrib, isha } = t;

  if (now < fajr - 0.5) return "night";
  if (now < fajr) return "predawn";
  if (now < sunrise) return "predawn";
  if (now < sunrise + 1.1) return "dawn";
  if (now < dhuhr - 1) return "morning";
  if (now < dhuhr + 2.4) return "midday";
  if (now < sunset - 0.7) return "afternoon";
  if (now < maghrib + 0.4) return "dusk";
  if (now < isha + 1) return "evening";
  return "night";
}

export function skyColors(phase: SkyPhase): readonly [string, string, string] {
  return PALETTE[phase];
}

/** Stars fade in only when the sky is genuinely dark. */
export function starsVisible(phase: SkyPhase): boolean {
  return phase === "night" || phase === "predawn" || phase === "evening";
}

/** True when the hero needs light text on a bright sky (the pale phases). */
export function isBrightPhase(phase: SkyPhase): boolean {
  return phase === "midday" || phase === "morning";
}

/**
 * A greeting anchored to solar events rather than clock hours, so it stays
 * truthful in Reykjavík in June and in Najaf in December alike.
 */
export function greeting(now: number, t: Times): string {
  if (now < t.fajr) return "A blessed night";
  if (now < t.sunrise) return "Dawn is near";
  if (now < t.dhuhr) return "Good morning";
  if (now < t.sunset) return "Good afternoon";
  return "Good evening";
}
