/**
 * Shared domain types for Awqāt.
 *
 * This module is the contract between the prayer engine, the notification
 * system, the audio layer and the UI. It is dependency-free and safe to import
 * from both the browser and Node (the push cron imports it server-side).
 */

// ---------------------------------------------------------------------------
// Time keys
// ---------------------------------------------------------------------------

/** The six rows shown in the timetable (sunrise marks the end of Fajr). */
export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

/** Everything the engine computes, including non-prayer markers. */
export type TimeKey = PrayerKey | "imsak" | "sunset" | "midnight";

/** Prayers that can raise an alert — sunrise is informational only. */
export type AlertableKey = Exclude<PrayerKey, "sunrise">;

/** Computed times as fractional local hours. May exceed 24 for next-day values. */
export type Times = Record<TimeKey, number>;

export interface PrayerMeta {
  key: PrayerKey;
  en: string;
  ar: string;
  translit: string;
  /** Short explanation shown under the name. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export interface Loc {
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** IANA timezone, or null to use the device's own offset (GPS results). */
  tz: string | null;
  /** Metres above sea level; raises the horizon slightly for sunrise/sunset. */
  elevation?: number;
  /** How the location was obtained — drives UI copy and re-prompt logic. */
  source?: "gps" | "city" | "manual" | "default";
}

// ---------------------------------------------------------------------------
// Calculation settings
// ---------------------------------------------------------------------------

export type MethodKey =
  | "jafari_leva"
  | "tehran"
  | "karbala"
  | "mwl"
  | "isna"
  | "makkah"
  | "karachi"
  | "custom";

/**
 * Whether Maghrib follows the Shia ruling (sun must sink to a depression
 * angle, i.e. the redness leaves the sky) or the Sunni ruling (at sunset).
 */
export type MaghribRule =
  | { kind: "angle"; angle: number }
  | { kind: "sunset" }
  | { kind: "offset"; minutes: number };

/** Shadow-length factor for Asr: 1 = majority/Ja'fari, 2 = Hanafi. */
export type AsrFactor = 1 | 2;

export interface MethodDef {
  key: MethodKey;
  label: string;
  /** Longer description shown in the method picker. */
  description: string;
  /** Sun depression below the horizon at Fajr, in degrees. */
  fajrAngle: number;
  /** Isha as a depression angle, or a fixed offset after Maghrib. */
  isha: { kind: "angle"; angle: number } | { kind: "offset"; minutes: number };
  maghrib: MaghribRule;
  asrFactor: AsrFactor;
  /** True for the rulings that follow Ja'fari fiqh. */
  jafari: boolean;
}

/**
 * Behaviour when the sun never reaches the required depression angle
 * (high latitudes in summer — Vancouver, Stockholm, …).
 */
export type HighLatRule =
  | "none"
  | "middle_of_night"
  | "one_seventh"
  | "angle_based";

/** Per-prayer manual correction in minutes, applied after computation. */
export type Adjustments = Record<PrayerKey, number>;

export interface CalcSettings {
  method: MethodKey;
  /** Only consulted when `method === "custom"`. */
  customFajrAngle: number;
  customIshaAngle: number;
  asrFactor: AsrFactor;
  highLatRule: HighLatRule;
  adjustments: Adjustments;
  /** Minutes before Fajr that Imsak begins. */
  imsakMinutes: number;
}

// ---------------------------------------------------------------------------
// Notifications & audio
// ---------------------------------------------------------------------------

/** How a given prayer should announce itself. */
export type AlertMode = "off" | "notify" | "sound";

export interface PrayerAlertSetting {
  mode: AlertMode;
  /** Id from the adhan catalogue (see lib/audio/catalog.ts). */
  soundId: string;
  /** Fire this many minutes before the prayer (0 = exactly on time). */
  offsetMinutes: number;
}

export type AlertSettings = Record<AlertableKey, PrayerAlertSetting>;

/**
 * A sound the user can pick in Settings. `kind` decides how it is produced:
 *  - "file"  → bundled or remote audio asset
 *  - "synth" → generated with the Web Audio API (works offline, zero bytes)
 *  - "none"  → silent; the system notification still appears
 */
export interface AdhanOption {
  id: string;
  label: string;
  /** Short attribution / description line. */
  detail: string;
  kind: "file" | "synth" | "none";
  /** Present when kind === "file". */
  src?: string;
  /** Present when kind === "synth" — selects the generator. */
  synth?: "chime" | "bell" | "takbir";
  /** Licence string shown in the credits panel. */
  licence?: string;
  /** Approximate duration in seconds, for the UI. */
  seconds?: number;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/** What the server stores per device so it can compute times without the client. */
export interface PushRecord {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  loc: Loc;
  calc: CalcSettings;
  alerts: AlertSettings;
  /** IANA timezone resolved at subscribe time. */
  tz: string;
  /** ISO timestamp of the last successful send, for de-duplication. */
  lastSentKey?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export interface FormattedTime {
  /** e.g. "5:42" or "05:42" */
  time: string;
  /** "AM" / "PM", empty in 24-hour mode. */
  suffix: string;
}

export type ThemeMode = "system" | "dark" | "light";
export type TimeFormat = "12h" | "24h";
