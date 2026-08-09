import {
  ALERTABLE,
  DEFAULT_ALERTS,
  DEFAULT_CALC,
  NO_ADJUSTMENTS,
  PRAYERS,
  STORAGE_KEYS,
} from "@/lib/constants";
import { DEFAULT_CITY } from "@/lib/cities";
import { METHODS } from "@/lib/prayer";
import { getJSON, getRaw, remove, setJSON, setRaw } from "@/lib/store";
import { isValidTimeZone } from "@/lib/time";
import type {
  Adjustments,
  AlertMode,
  AlertSettings,
  AsrFactor,
  CalcSettings,
  HighLatRule,
  Loc,
  MethodKey,
  PrayerAlertSetting,
  ThemeMode,
  TimeFormat,
} from "@/lib/types";

/**
 * Reading and writing the persisted settings.
 *
 * The rule this module exists to enforce: **nothing from localStorage is
 * trusted**. Stored values can come from an older version of the app, from a
 * half-finished write, from a user poking at devtools, or from a completely
 * different app that once used the same origin. A single `undefined` where a
 * number was expected propagates into the astronomy code and produces `NaN`
 * times — a silently wrong timetable, which is the worst possible failure for
 * this app. So every loader validates field by field and substitutes the
 * documented default for anything it does not recognise.
 */

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Everything the app persists, in one object. */
export interface PersistedSettings {
  loc: Loc;
  calc: CalcSettings;
  alerts: AlertSettings;
  timeFormat: TimeFormat;
  theme: ThemeMode;
  /** Advanced: a user-supplied adhan audio URL, or "" for the catalogue. */
  customAdhanUrl: string;
  /**
   * Show live weather on the hero. This is the ONE feature that sends
   * anything off-device (coarsened coordinates, to Open-Meteo), so it is a
   * setting rather than an assumption.
   */
  weather: boolean;
  /** Days to shift the Hijri date by, for local moon sighting. */
  hijriOffset: number;
  /** True once the user has been through first-run location setup. */
  onboarded: boolean;
}

export const DEFAULT_LOC: Loc = { ...DEFAULT_CITY, source: "default" };

/** Deep-copy an alert map so callers can never mutate the shared defaults. */
function cloneAlerts(source: AlertSettings): AlertSettings {
  const out = {} as AlertSettings;
  for (const key of ALERTABLE) out[key] = { ...source[key] };
  return out;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  loc: DEFAULT_LOC,
  calc: { ...DEFAULT_CALC, adjustments: { ...NO_ADJUSTMENTS } },
  alerts: cloneAlerts(DEFAULT_ALERTS),
  timeFormat: "12h",
  theme: "system",
  customAdhanUrl: "",
  weather: true,
  hijriOffset: 0,
  onboarded: false,
};

/**
 * The custom adhan URL lives outside `STORAGE_KEYS` because that map is frozen
 * for v2; the key still carries the app namespace so a reset finds it.
 */
export const CUSTOM_ADHAN_URL_KEY = "awqat.customAdhanUrl";

/** Same rationale as the adhan URL: added after STORAGE_KEYS was frozen. */
export const WEATHER_KEY = "awqat.weather.enabled";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite number inside [min,max], or the fallback. */
function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** A finite integer inside [min,max], or the fallback. */
function int(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(num(value, min, max, fallback));
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const METHOD_KEYS = Object.keys(METHODS) as MethodKey[];
const HIGH_LAT_RULES: readonly HighLatRule[] = [
  "none",
  "middle_of_night",
  "one_seventh",
  "angle_based",
];
const ALERT_MODES: readonly AlertMode[] = ["off", "notify", "sound"];
const THEMES: readonly ThemeMode[] = ["system", "dark", "light"];
const TIME_FORMATS: readonly TimeFormat[] = ["12h", "24h"];
const LOC_SOURCES: readonly NonNullable<Loc["source"]>[] = [
  "gps",
  "city",
  "manual",
  "default",
];

// ---------------------------------------------------------------------------
// Sanitisers — unknown in, valid domain object out
// ---------------------------------------------------------------------------

/**
 * Coerce an unknown value into a usable Loc.
 *
 * A stored zone that the runtime does not recognise (a renamed IANA zone, a
 * typo, an old Windows-style name) is downgraded to `null` rather than
 * discarded: the coordinates are still right, and `tz: null` means "use the
 * device's own offset", which is the safest possible fallback.
 */
export function sanitizeLoc(value: unknown): Loc | null {
  if (!isRecord(value)) return null;
  const lat = value.lat;
  const lng = value.lng;
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const tz = typeof value.tz === "string" && isValidTimeZone(value.tz) ? value.tz : null;
  const loc: Loc = {
    name: str(value.name, "Saved location"),
    country: typeof value.country === "string" ? value.country : "",
    lat,
    lng,
    tz,
    source: oneOf(value.source, LOC_SOURCES, "manual"),
  };
  if (typeof value.elevation === "number" && Number.isFinite(value.elevation)) {
    loc.elevation = num(value.elevation, -500, 9000, 0);
  }
  return loc;
}

function sanitizeAdjustments(value: unknown): Adjustments {
  const out: Adjustments = { ...NO_ADJUSTMENTS };
  if (!isRecord(value)) return out;
  for (const prayer of PRAYERS) {
    // ±120 minutes is far wider than any real correction, and narrow enough
    // that a corrupt value cannot reorder the day.
    out[prayer.key] = int(value[prayer.key], -120, 120, 0);
  }
  return out;
}

/** Coerce an unknown value into complete, in-range calculation settings. */
export function sanitizeCalc(value: unknown): CalcSettings {
  if (!isRecord(value)) return { ...DEFAULT_CALC, adjustments: { ...NO_ADJUSTMENTS } };
  const asrFactor: AsrFactor = value.asrFactor === 2 ? 2 : 1;
  return {
    method: oneOf(value.method, METHOD_KEYS, DEFAULT_CALC.method),
    customFajrAngle: num(value.customFajrAngle, 5, 30, DEFAULT_CALC.customFajrAngle),
    customIshaAngle: num(value.customIshaAngle, 5, 30, DEFAULT_CALC.customIshaAngle),
    asrFactor,
    highLatRule: oneOf(value.highLatRule, HIGH_LAT_RULES, DEFAULT_CALC.highLatRule),
    adjustments: sanitizeAdjustments(value.adjustments),
    imsakMinutes: int(value.imsakMinutes, 0, 120, DEFAULT_CALC.imsakMinutes),
  };
}

function sanitizeAlert(value: unknown, fallback: PrayerAlertSetting): PrayerAlertSetting {
  if (!isRecord(value)) return { ...fallback };
  return {
    mode: oneOf(value.mode, ALERT_MODES, fallback.mode),
    soundId: str(value.soundId, fallback.soundId),
    // Alerts only ever fire early, never late: a "reminder" after the prayer
    // has started is not a reminder.
    offsetMinutes: int(value.offsetMinutes, 0, 120, fallback.offsetMinutes),
  };
}

/**
 * Coerce an unknown value into a complete alert map.
 *
 * Missing prayers are filled from the defaults rather than dropped, so a
 * partially written object can never leave a prayer with no setting at all
 * (which would read as `undefined.mode` in the scheduler).
 */
export function sanitizeAlerts(value: unknown): AlertSettings {
  const source = isRecord(value) ? value : {};
  const out = {} as AlertSettings;
  for (const key of ALERTABLE) {
    out[key] = sanitizeAlert(source[key], DEFAULT_ALERTS[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// v1 → v2 migration
// ---------------------------------------------------------------------------

/** Marks the one-time v1 import as done. Not part of the frozen key set. */
const MIGRATION_KEY = "awqat.migrated.v1";

/** The un-namespaced keys v1 wrote directly to localStorage. */
const V1_KEYS = {
  loc: "loc",
  method: "method",
  fmt: "fmt",
  alerts: "alerts",
  adhanUrl: "adhanUrl",
  reciter: "reciter",
} as const;

/** v1 only shipped two methods, under short names. */
const V1_METHOD_MAP: Record<string, MethodKey> = {
  leva: "jafari_leva",
  tehran: "tehran",
};

let migrationChecked = false;

/**
 * Import v1's settings the first time v2 runs.
 *
 * Losing someone's city on upgrade means they open the app to the wrong
 * timetable and have no idea why, so this runs before any loader. It only
 * *fills* keys that v2 has not written yet, and it deliberately leaves the v1
 * keys in place: they are a few hundred bytes, and keeping them means a user
 * who rolls back does not lose anything either.
 */
export function migrateLegacySettings(): void {
  if (migrationChecked) return;
  migrationChecked = true;
  if (typeof window === "undefined") return;
  if (getRaw(MIGRATION_KEY) === "1") return;

  // v1 stored the location as a JSON blob under the bare key "loc".
  if (getRaw(STORAGE_KEYS.loc) === null) {
    const legacyLoc = sanitizeLoc(getJSON<unknown>(V1_KEYS.loc, null));
    if (legacyLoc) {
      // v1 had no `source`; anything it saved was picked in the city sheet or
      // resolved from GPS, and a zone-less entry is necessarily a GPS fix.
      setJSON(STORAGE_KEYS.loc, {
        ...legacyLoc,
        source: legacyLoc.tz ? "city" : "gps",
      } satisfies Loc);
    }
  }

  if (getRaw(STORAGE_KEYS.calc) === null) {
    const legacyMethod = getRaw(V1_KEYS.method);
    const method = legacyMethod ? V1_METHOD_MAP[legacyMethod] : undefined;
    if (method) setJSON(STORAGE_KEYS.calc, { ...DEFAULT_CALC, method });
  }

  if (getRaw(STORAGE_KEYS.timeFormat) === null) {
    const legacyFmt = getRaw(V1_KEYS.fmt);
    if (legacyFmt === "24" || legacyFmt === "24h") {
      setJSON<TimeFormat>(STORAGE_KEYS.timeFormat, "24h");
    } else if (legacyFmt === "12" || legacyFmt === "12h") {
      setJSON<TimeFormat>(STORAGE_KEYS.timeFormat, "12h");
    }
  }

  if (getRaw(STORAGE_KEYS.alerts) === null) {
    // v1 had a single on/off switch for all prayers ("1" / "0").
    const legacyAlerts = getRaw(V1_KEYS.alerts);
    if (legacyAlerts === "0") {
      const off = {} as AlertSettings;
      for (const key of ALERTABLE) {
        off[key] = { ...DEFAULT_ALERTS[key], mode: "off" };
      }
      setJSON(STORAGE_KEYS.alerts, off);
    } else if (legacyAlerts === "1") {
      setJSON(STORAGE_KEYS.alerts, DEFAULT_ALERTS);
    }
  }

  // Someone who had alerts configured in v1 has already been through setup.
  if (getRaw(STORAGE_KEYS.onboarded) === null && getRaw(V1_KEYS.loc) !== null) {
    setRaw(STORAGE_KEYS.onboarded, "1");
  }

  setRaw(MIGRATION_KEY, "1");
}

/**
 * v1's audio preferences, which have no direct v2 equivalent.
 *
 * v1 let you paste an arbitrary adhan URL and pick a Qur'an reciter; v2 has a
 * curated sound catalogue instead. Rather than guess a mapping, the raw values
 * are exposed so the audio layer can offer to re-add a custom URL explicitly.
 */
export function legacyAudioPreferences(): {
  adhanUrl: string | null;
  reciter: string | null;
} {
  return {
    adhanUrl: getRaw(V1_KEYS.adhanUrl),
    reciter: getRaw(V1_KEYS.reciter),
  };
}

// ---------------------------------------------------------------------------
// Loaders and savers
// ---------------------------------------------------------------------------

export function loadLoc(): Loc {
  migrateLegacySettings();
  return sanitizeLoc(getJSON<unknown>(STORAGE_KEYS.loc, null)) ?? DEFAULT_LOC;
}

export function saveLoc(loc: Loc): void {
  const clean = sanitizeLoc(loc);
  if (clean) setJSON(STORAGE_KEYS.loc, clean);
}

export function loadCalc(): CalcSettings {
  migrateLegacySettings();
  return sanitizeCalc(getJSON<unknown>(STORAGE_KEYS.calc, null));
}

export function saveCalc(calc: CalcSettings): void {
  setJSON(STORAGE_KEYS.calc, sanitizeCalc(calc));
}

export function loadAlerts(): AlertSettings {
  migrateLegacySettings();
  return sanitizeAlerts(getJSON<unknown>(STORAGE_KEYS.alerts, null));
}

export function saveAlerts(alerts: AlertSettings): void {
  setJSON(STORAGE_KEYS.alerts, sanitizeAlerts(alerts));
}

export function loadTimeFormat(): TimeFormat {
  migrateLegacySettings();
  return oneOf(
    getJSON<unknown>(STORAGE_KEYS.timeFormat, null),
    TIME_FORMATS,
    DEFAULT_SETTINGS.timeFormat,
  );
}

export function saveTimeFormat(format: TimeFormat): void {
  setJSON<TimeFormat>(
    STORAGE_KEYS.timeFormat,
    oneOf(format, TIME_FORMATS, DEFAULT_SETTINGS.timeFormat),
  );
}

export function loadTheme(): ThemeMode {
  migrateLegacySettings();
  return oneOf(
    getJSON<unknown>(STORAGE_KEYS.theme, null),
    THEMES,
    DEFAULT_SETTINGS.theme,
  );
}

export function saveTheme(theme: ThemeMode): void {
  setJSON<ThemeMode>(STORAGE_KEYS.theme, oneOf(theme, THEMES, DEFAULT_SETTINGS.theme));
}

/**
 * The advanced "bring your own adhan" URL.
 *
 * This is the only free-form string a user can type that later gets handed to
 * an `<audio src>`, so it is re-validated on every read rather than trusted
 * from storage: only http(s) survives, and anything else — including a
 * `javascript:` or `data:` URL — collapses to "" (use the catalogue instead).
 */
export function sanitizeCustomAdhanUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const { protocol } = new URL(trimmed);
    return protocol === "https:" || protocol === "http:" ? trimmed : "";
  } catch {
    return "";
  }
}

export function loadWeatherEnabled(): boolean {
  migrateLegacySettings();
  const raw = getJSON<unknown>(WEATHER_KEY, null);
  return typeof raw === "boolean" ? raw : DEFAULT_SETTINGS.weather;
}

export function saveWeatherEnabled(on: boolean): void {
  setJSON<boolean>(WEATHER_KEY, Boolean(on));
}

export function loadCustomAdhanUrl(): string {
  migrateLegacySettings();
  return sanitizeCustomAdhanUrl(getJSON<unknown>(CUSTOM_ADHAN_URL_KEY, null));
}

export function saveCustomAdhanUrl(url: string): void {
  setJSON<string>(CUSTOM_ADHAN_URL_KEY, sanitizeCustomAdhanUrl(url));
}

/**
 * Clamp the Hijri correction to ±2 days — the range local moon sighting
 * actually varies over. Anything wider is a corrupt value, not a preference.
 */
export function sanitizeHijriOffset(days: unknown): number {
  return int(days, -2, 2, 0);
}

export function loadHijriOffset(): number {
  migrateLegacySettings();
  return sanitizeHijriOffset(getJSON<unknown>(STORAGE_KEYS.hijriOffset, null));
}

export function saveHijriOffset(days: number): void {
  setJSON<number>(STORAGE_KEYS.hijriOffset, sanitizeHijriOffset(days));
}

export function loadOnboarded(): boolean {
  migrateLegacySettings();
  return getRaw(STORAGE_KEYS.onboarded) === "1";
}

export function saveOnboarded(done: boolean): void {
  if (done) setRaw(STORAGE_KEYS.onboarded, "1");
  else remove(STORAGE_KEYS.onboarded);
}

/**
 * Read everything in one pass.
 *
 * Used by the settings store on hydration: one call means one migration check
 * and a single consistent snapshot, instead of six independent reads that
 * could interleave with a write from another tab.
 */
export function loadSettings(): PersistedSettings {
  migrateLegacySettings();
  return {
    loc: loadLoc(),
    calc: loadCalc(),
    alerts: loadAlerts(),
    timeFormat: loadTimeFormat(),
    theme: loadTheme(),
    customAdhanUrl: loadCustomAdhanUrl(),
    weather: loadWeatherEnabled(),
    hijriOffset: loadHijriOffset(),
    onboarded: loadOnboarded(),
  };
}

/** Persist a whole snapshot. Each field goes through its own validator. */
export function saveSettings(settings: PersistedSettings): void {
  saveLoc(settings.loc);
  saveCalc(settings.calc);
  saveAlerts(settings.alerts);
  saveTimeFormat(settings.timeFormat);
  saveTheme(settings.theme);
  saveHijriOffset(settings.hijriOffset);
  saveOnboarded(settings.onboarded);
}

/** Forget every stored preference and return to first-run defaults. */
export function resetSettings(): void {
  for (const key of Object.values(STORAGE_KEYS)) remove(key);
  remove(MIGRATION_KEY);
  migrationChecked = false;
}
