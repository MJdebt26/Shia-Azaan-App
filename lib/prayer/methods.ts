import type { MethodDef, MethodKey } from "../types";

/**
 * Calculation methods.
 *
 * The Shia (Ja'fari) methods differ from the Sunni ones in two places:
 *
 *  1. **Maghrib** is not at sunset. The sun must sink far enough that the
 *     eastern redness (ḥumra mashriqiyya) passes overhead — modelled as a
 *     depression angle of roughly 4°.
 *  2. **Midnight** (for the end of Isha and the start of the night prayers)
 *     is the midpoint between sunset and *Fajr*, not sunset and sunrise.
 *
 * The Sunni methods are included so travellers can match a local mosque's
 * printed timetable; they are clearly labelled as such in the picker.
 */
export const METHODS: Record<MethodKey, MethodDef> = {
  jafari_leva: {
    key: "jafari_leva",
    label: "Ja'fari — Leva Institute, Qom",
    description:
      "The common Shia standard. Fajr 16°, Isha 14°, Maghrib when the sun is 4° below the horizon.",
    fajrAngle: 16,
    isha: { kind: "angle", angle: 14 },
    maghrib: { kind: "angle", angle: 4 },
    asrFactor: 1,
    jafari: true,
  },
  tehran: {
    key: "tehran",
    label: "Institute of Geophysics, Tehran",
    description:
      "Used across Iran. Slightly earlier Fajr (17.7°) and Maghrib at 4.5° below the horizon.",
    fajrAngle: 17.7,
    isha: { kind: "angle", angle: 14 },
    maghrib: { kind: "angle", angle: 4.5 },
    asrFactor: 1,
    jafari: true,
  },
  karbala: {
    key: "karbala",
    label: "Ja'fari — 15° / 15°",
    description:
      "A slightly later Fajr and earlier Isha, followed by a number of Iraqi communities.",
    fajrAngle: 15,
    isha: { kind: "angle", angle: 15 },
    maghrib: { kind: "angle", angle: 4 },
    asrFactor: 1,
    jafari: true,
  },
  mwl: {
    key: "mwl",
    label: "Muslim World League (Sunni)",
    description: "Fajr 18°, Isha 17°, Maghrib at sunset.",
    fajrAngle: 18,
    isha: { kind: "angle", angle: 17 },
    maghrib: { kind: "sunset" },
    asrFactor: 1,
    jafari: false,
  },
  isna: {
    key: "isna",
    label: "ISNA — North America (Sunni)",
    description: "Fajr 15°, Isha 15°, Maghrib at sunset.",
    fajrAngle: 15,
    isha: { kind: "angle", angle: 15 },
    maghrib: { kind: "sunset" },
    asrFactor: 1,
    jafari: false,
  },
  makkah: {
    key: "makkah",
    label: "Umm al-Qurā, Makkah (Sunni)",
    description: "Fajr 18.5°, Isha 90 minutes after Maghrib.",
    fajrAngle: 18.5,
    isha: { kind: "offset", minutes: 90 },
    maghrib: { kind: "sunset" },
    asrFactor: 1,
    jafari: false,
  },
  karachi: {
    key: "karachi",
    label: "Univ. of Islamic Sciences, Karachi (Sunni)",
    description: "Fajr 18°, Isha 18°, Maghrib at sunset.",
    fajrAngle: 18,
    isha: { kind: "angle", angle: 18 },
    maghrib: { kind: "sunset" },
    asrFactor: 1,
    jafari: false,
  },
  custom: {
    key: "custom",
    label: "Custom angles",
    description: "Set your own Fajr and Isha depression angles.",
    fajrAngle: 16,
    isha: { kind: "angle", angle: 14 },
    maghrib: { kind: "angle", angle: 4 },
    asrFactor: 1,
    jafari: true,
  },
};

export const METHOD_ORDER: MethodKey[] = [
  "jafari_leva",
  "tehran",
  "karbala",
  "mwl",
  "isna",
  "makkah",
  "karachi",
  "custom",
];

export const JAFARI_METHODS = METHOD_ORDER.filter((k) => METHODS[k].jafari);
export const OTHER_METHODS = METHOD_ORDER.filter((k) => !METHODS[k].jafari);
