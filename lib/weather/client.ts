import { getJSON, setJSON } from "@/lib/store";
import { decodeWmo, refineByCloudCover } from "./codes";
import type { WeatherSnapshot } from "./types";

/**
 * Weather provider: Open-Meteo.
 *
 * Chosen because it needs no API key and sets permissive CORS headers, so the
 * app stays deployable by anyone who clones it — no secret to leak, nothing to
 * proxy. It is the only outbound request the app makes for a feature the user
 * can see, so two things are non-negotiable:
 *
 *   1. Coordinates are rounded to two decimals (~1.1 km) before they are sent.
 *      Weather does not vary meaningfully below that, and it means the exact
 *      location computed for prayer times is never transmitted.
 *   2. It is cached and it fails quietly. Prayer times must never depend on it.
 */

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/** Readings older than this are refetched. Weather does not move fast. */
export const WEATHER_TTL_MS = 15 * 60_000;

/** Beyond this, a cached reading is not worth showing at all. */
export const WEATHER_MAX_AGE_MS = 6 * 3_600_000;

const CACHE_KEY = "awqat.weather";
const TIMEOUT_MS = 8_000;

/** ~1.1 km. Enough for weather, coarse enough not to pinpoint a home. */
export function coarsen(value: number): number {
  return Math.round(value * 100) / 100;
}

interface CacheEntry {
  /** The rounded coordinates the reading belongs to. */
  lat: number;
  lng: number;
  snapshot: WeatherSnapshot;
}

function cacheKeyMatches(entry: CacheEntry, lat: number, lng: number): boolean {
  return entry.lat === coarsen(lat) && entry.lng === coarsen(lng);
}

/** Last good reading for these coordinates, however old. */
export function readCache(lat: number, lng: number): WeatherSnapshot | null {
  const entry = getJSON<CacheEntry | null>(CACHE_KEY, null);
  if (!entry || typeof entry !== "object") return null;
  if (!entry.snapshot || !cacheKeyMatches(entry, lat, lng)) return null;
  const age = Date.now() - entry.snapshot.observedAt;
  if (!Number.isFinite(age) || age > WEATHER_MAX_AGE_MS) return null;
  return entry.snapshot;
}

function writeCache(lat: number, lng: number, snapshot: WeatherSnapshot): void {
  setJSON<CacheEntry>(CACHE_KEY, {
    lat: coarsen(lat),
    lng: coarsen(lng),
    snapshot,
  });
}

/** True when a cached reading is fresh enough to skip the network entirely. */
export function isFresh(snapshot: WeatherSnapshot): boolean {
  return Date.now() - snapshot.observedAt < WEATHER_TTL_MS;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Build a snapshot from a provider payload. Split out from the fetch so it can
 * be unit-tested against recorded responses without touching the network.
 */
export function parseCurrent(payload: unknown): WeatherSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const current = (payload as { current?: unknown }).current;
  if (!current || typeof current !== "object") return null;

  const c = current as Record<string, unknown>;
  const code = c.weather_code;
  const decoded = decodeWmo(code);
  const cloudCover = num(c.cloud_cover, 0);

  return {
    kind: refineByCloudCover(decoded.kind, cloudCover),
    intensity: decoded.intensity,
    code: typeof code === "number" ? code : -1,
    label: decoded.label,
    temperatureC: num(c.temperature_2m, NaN),
    windKph: Math.max(0, num(c.wind_speed_10m, 0)),
    cloudCover: Math.min(100, Math.max(0, cloudCover)),
    isDay: c.is_day === 1 || c.is_day === true,
    observedAt: Date.now(),
  };
}

export class WeatherError extends Error {}

/**
 * Fetch the current conditions. Resolves with a snapshot, or throws a
 * `WeatherError` carrying a sentence that is safe to show the user.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", String(coarsen(lat)));
  url.searchParams.set("longitude", String(coarsen(lng)));
  url.searchParams.set(
    "current",
    "temperature_2m,is_day,weather_code,cloud_cover,wind_speed_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");

  // Our own deadline: a hung request should not leave the UI "loading" forever.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const composite = signal
    ? AbortSignal.any([signal, timeout.signal])
    : timeout.signal;

  try {
    const response = await fetch(url, { signal: composite, cache: "no-store" });
    if (!response.ok) {
      throw new WeatherError(
        `The weather service returned ${response.status}. Prayer times are unaffected.`,
      );
    }
    const snapshot = parseCurrent(await response.json());
    if (!snapshot) {
      throw new WeatherError("The weather service sent an unexpected response.");
    }
    writeCache(lat, lng, snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    if ((error as Error)?.name === "AbortError") {
      // A caller-driven abort is not a failure; a timeout is.
      if (signal?.aborted) throw error;
      throw new WeatherError("The weather service timed out.");
    }
    throw new WeatherError(
      "Could not reach the weather service. Prayer times still work offline.",
    );
  } finally {
    clearTimeout(timer);
  }
}
