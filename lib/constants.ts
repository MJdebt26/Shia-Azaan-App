import type {
  AlertSettings,
  Adjustments,
  AlertableKey,
  CalcSettings,
  PrayerMeta,
} from "./types";

export const APP_NAME = "Awqāt";
export const APP_TAGLINE = "Ja'fari prayer times, computed on your device";

/** Display order of the timetable. */
export const PRAYERS: readonly PrayerMeta[] = [
  { key: "fajr", en: "Fajr", ar: "الفجر", translit: "al-Fajr" },
  {
    key: "sunrise",
    en: "Sunrise",
    ar: "الشروق",
    translit: "ash-Shurūq",
    note: "Fajr ends",
  },
  { key: "dhuhr", en: "Dhuhr", ar: "الظهر", translit: "aẓ-Ẓuhr" },
  { key: "asr", en: "Asr", ar: "العصر", translit: "al-ʿAṣr" },
  { key: "maghrib", en: "Maghrib", ar: "المغرب", translit: "al-Maghrib" },
  { key: "isha", en: "Isha", ar: "العشاء", translit: "al-ʿIshāʾ" },
] as const;

/** Prayers that can raise an alert (everything except sunrise). */
export const ALERTABLE: readonly AlertableKey[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;

export const PRAYER_BY_KEY = Object.fromEntries(
  PRAYERS.map((p) => [p.key, p]),
) as Record<PrayerMeta["key"], PrayerMeta>;

export const NO_ADJUSTMENTS: Adjustments = {
  fajr: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export const DEFAULT_CALC: CalcSettings = {
  method: "jafari_leva",
  customFajrAngle: 16,
  customIshaAngle: 14,
  asrFactor: 1,
  // Angle-based is the most widely published fallback and matches the
  // reference timetables this engine is tested against.
  highLatRule: "angle_based",
  adjustments: { ...NO_ADJUSTMENTS },
  imsakMinutes: 10,
};

/**
 * Fajr defaults to the gentler chime: a full adhan at 4am is the single most
 * common reason people turn prayer notifications off entirely.
 */
export const DEFAULT_ALERTS: AlertSettings = {
  fajr: { mode: "sound", soundId: "chime", offsetMinutes: 0 },
  dhuhr: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 0 },
  asr: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 0 },
  maghrib: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 0 },
  isha: { mode: "sound", soundId: "adhan-fakhri", offsetMinutes: 0 },
};

/** localStorage keys, namespaced so a shared origin can't collide. */
export const STORAGE_KEYS = {
  loc: "awqat.loc",
  calc: "awqat.calc",
  alerts: "awqat.alerts",
  timeFormat: "awqat.timeFormat",
  theme: "awqat.theme",
  hijriOffset: "awqat.hijriOffset",
  onboarded: "awqat.onboarded",
  pushEndpoint: "awqat.pushEndpoint",
} as const;
