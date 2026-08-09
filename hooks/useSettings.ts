"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings as clearStoredSettings,
  saveAlerts,
  saveCalc,
  saveHijriOffset,
  saveLoc,
  saveOnboarded,
  saveTheme,
  saveCustomAdhanUrl,
  saveWeatherEnabled,
  sanitizeCustomAdhanUrl,
  saveTimeFormat,
  sanitizeAlerts,
  sanitizeCalc,
  sanitizeHijriOffset,
  sanitizeLoc,
  type PersistedSettings,
} from "@/lib/settings";
import type {
  AlertSettings,
  AlertableKey,
  CalcSettings,
  Loc,
  PrayerAlertSetting,
  ThemeMode,
  TimeFormat,
} from "@/lib/types";

/**
 * The single source of truth for user settings.
 *
 * This is a tiny external store read through `useSyncExternalStore` rather than
 * per-component `useState`, for two reasons:
 *
 *  - **One copy.** The timetable, the settings sheet and the alert scheduler
 *    all read the same settings. With `useState` in each, changing the city in
 *    one place would leave the others computing yesterday's timetable until
 *    they happened to re-mount.
 *  - **Honest hydration.** The server snapshot is the defaults, so the markup
 *    React renders on the server and the markup it hydrates on the client are
 *    identical — no mismatch warning, no flash of someone else's city. The
 *    stored values are read once when the first component subscribes (i.e.
 *    after mount) and everything re-renders together. `hydrated` tells the UI
 *    whether it is looking at real settings yet.
 */

export interface SettingsState extends PersistedSettings {
  /** False until the persisted values have been read from storage. */
  hydrated: boolean;
}

export interface UseSettings extends SettingsState {
  setLoc: (loc: Loc) => void;
  /** Merge a partial patch into the calculation settings. */
  setCalc: (patch: Partial<CalcSettings>) => void;
  /** Merge a partial patch into one prayer's alert setting. */
  setAlert: (key: AlertableKey, patch: Partial<PrayerAlertSetting>) => void;
  /** Merge a partial patch into the whole alert map. */
  setAlerts: (patch: Partial<AlertSettings>) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setTheme: (theme: ThemeMode) => void;
  /** Advanced: the user-supplied adhan URL, or "" to use the catalogue. */
  setCustomAdhanUrl: (url: string) => void;
  /** Turn the live weather layer (and its one network call) on or off. */
  setWeather: (on: boolean) => void;
  setHijriOffset: (days: number) => void;
  setOnboarded: (done: boolean) => void;
  /** Forget everything and return to first-run defaults. */
  reset: () => void;
}

const SERVER_SNAPSHOT: SettingsState = { ...DEFAULT_SETTINGS, hydrated: false };

let snapshot: SettingsState = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function publish(next: SettingsState): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // The first subscription happens in an effect, i.e. after hydration — the
  // right moment to touch localStorage.
  if (!snapshot.hydrated && typeof window !== "undefined") {
    publish({ ...loadSettings(), hydrated: true });
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Must stay pure and referentially stable, so it only reads the cache. */
function getSnapshot(): SettingsState {
  return snapshot;
}

function getServerSnapshot(): SettingsState {
  return SERVER_SNAPSHOT;
}

/** The current settings, for code outside React (schedulers, event handlers). */
export function readSettings(): SettingsState {
  return snapshot;
}

// ---------------------------------------------------------------------------
// Mutators — module level, so their identity is stable across renders
// ---------------------------------------------------------------------------

// Each mutator publishes the *sanitised* value, so what the UI renders is
// exactly what a reload would produce — an out-of-range setting can never look
// accepted until you come back and find it clamped.

function setLoc(loc: Loc): void {
  const clean = sanitizeLoc(loc);
  if (!clean) return;
  saveLoc(clean);
  publish({ ...snapshot, loc: clean });
}

function setCalc(patch: Partial<CalcSettings>): void {
  const calc = sanitizeCalc({ ...snapshot.calc, ...patch });
  saveCalc(calc);
  publish({ ...snapshot, calc });
}

function setAlert(key: AlertableKey, patch: Partial<PrayerAlertSetting>): void {
  const alerts = sanitizeAlerts({
    ...snapshot.alerts,
    [key]: { ...snapshot.alerts[key], ...patch },
  });
  saveAlerts(alerts);
  publish({ ...snapshot, alerts });
}

function setAlerts(patch: Partial<AlertSettings>): void {
  const alerts = sanitizeAlerts({ ...snapshot.alerts, ...patch });
  saveAlerts(alerts);
  publish({ ...snapshot, alerts });
}

function setTimeFormat(timeFormat: TimeFormat): void {
  saveTimeFormat(timeFormat);
  publish({ ...snapshot, timeFormat });
}

function setTheme(theme: ThemeMode): void {
  saveTheme(theme);
  publish({ ...snapshot, theme });
}

function setCustomAdhanUrl(url: string): void {
  const customAdhanUrl = sanitizeCustomAdhanUrl(url);
  saveCustomAdhanUrl(customAdhanUrl);
  publish({ ...snapshot, customAdhanUrl });
}

function setWeather(on: boolean): void {
  const weather = Boolean(on);
  saveWeatherEnabled(weather);
  publish({ ...snapshot, weather });
}

function setHijriOffset(days: number): void {
  const hijriOffset = sanitizeHijriOffset(days);
  saveHijriOffset(hijriOffset);
  publish({ ...snapshot, hijriOffset });
}

function setOnboarded(done: boolean): void {
  saveOnboarded(done);
  publish({ ...snapshot, onboarded: done });
}

function reset(): void {
  clearStoredSettings();
  // Stay "hydrated": storage has been read, it is simply empty now.
  publish({ ...DEFAULT_SETTINGS, hydrated: true });
}

/** Subscribe a component to the settings store. */
export function useSettings(): UseSettings {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...state,
    setLoc,
    setCalc,
    setAlert,
    setAlerts,
    setTimeFormat,
    setTheme,
    setCustomAdhanUrl,
    setWeather,
    setHijriOffset,
    setOnboarded,
    reset,
  };
}
