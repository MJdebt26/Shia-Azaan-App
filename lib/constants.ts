import type { PrayerMeta } from "./types";

/** The five daily prayers plus sunrise (which marks the end of Fajr). */
export const PRAYERS: PrayerMeta[] = [
  { key: "fajr", ar: "الفجر", en: "Fajr", icon: "dawn" },
  { key: "sunrise", ar: "الشروق", en: "Sunrise", icon: "sun", sub: "Fajr ends" },
  { key: "dhuhr", ar: "الظهر", en: "Dhuhr", icon: "noon" },
  { key: "asr", ar: "العصر", en: "Asr", icon: "after" },
  { key: "maghrib", ar: "المغرب", en: "Maghrib", icon: "dusk" },
  { key: "isha", ar: "العشاء", en: "Isha", icon: "night" },
];

/** Prayers that trigger an alert (sunrise is informational only). */
export const ALERT_PRAYERS = PRAYERS.filter((p) => p.key !== "sunrise");
