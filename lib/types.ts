export type MethodKey = "leva" | "tehran";

export interface Loc {
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** IANA timezone (e.g. "Asia/Tehran"), or null to use the device's offset. */
  tz: string | null;
}

export type PrayerKey =
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha";

export type TimeKey = PrayerKey | "imsak" | "midnight" | "sunset";

/** Computed times, in fractional local hours (0–24). */
export type Times = Record<TimeKey, number>;

export interface MethodDef {
  fajr: number;
  isha: number;
  maghrib: number;
  asr: number;
  label: string;
}

export interface PrayerMeta {
  key: PrayerKey;
  ar: string;
  en: string;
  icon: IconKey;
  sub?: string;
}

export type IconKey = "dawn" | "sun" | "noon" | "after" | "dusk" | "night";

export interface FormattedTime {
  h: string;
  ap: string;
}
