"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WEATHER_TTL_MS,
  fetchWeather,
  isFresh,
  readCache,
} from "@/lib/weather/client";
import type { WeatherState } from "@/lib/weather/types";

/**
 * Current conditions for a set of coordinates.
 *
 * Deliberately forgiving: the app is offline-first and prayer times never
 * depend on this. A failure leaves the last cached reading on screen (marked
 * stale) and the sky simply keeps its clear-weather colours.
 *
 * @param lat      latitude, or null while the location is still resolving
 * @param lng      longitude
 * @param enabled  the user's setting; false makes this a complete no-op and
 *                 no request is ever made
 */
export function useWeather(
  lat: number | null,
  lng: number | null,
  enabled: boolean,
): WeatherState & { refresh: () => void } {
  const [state, setState] = useState<WeatherState>({
    data: null,
    loading: false,
    error: null,
    stale: false,
  });

  // Bumped by refresh() to force a re-run past the freshness check.
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Rounded to the grid the request actually uses, so drifting a few metres
  // does not retrigger a fetch.
  const key = lat === null || lng === null ? null : `${lat.toFixed(2)},${lng.toFixed(2)}`;

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null, stale: false });
      return;
    }
    if (key === null || lat === null || lng === null) return;

    const controller = new AbortController();
    let cancelled = false;

    const run = async (): Promise<void> => {
      // Show the cached reading immediately — the sky should never flash
      // through "clear" on its way to the real conditions.
      const cached = readCache(lat, lng);
      if (cached && !cancelled) {
        setState({
          data: cached,
          loading: !isFresh(cached),
          error: null,
          stale: !isFresh(cached),
        });
        if (isFresh(cached) && nonce === 0) return;
      } else if (!cancelled) {
        setState((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const data = await fetchWeather(lat, lng, controller.signal);
        if (!cancelled) {
          setState({ data, loading: false, error: null, stale: false });
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setState((s) => ({
          // Keep whatever we were showing; a stale sky beats a blank one.
          data: s.data,
          loading: false,
          error: (error as Error).message,
          stale: s.data !== null,
        }));
      }
    };

    void run();

    // Refresh on a timer, and whenever the user comes back to the app after
    // long enough that the reading could have changed.
    const interval = window.setInterval(() => {
      if (!document.hidden && enabledRef.current) void run();
    }, WEATHER_TTL_MS);

    const onVisible = (): void => {
      if (document.hidden || !enabledRef.current) return;
      const current = readCache(lat, lng);
      if (!current || !isFresh(current)) void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, lat, lng, enabled, nonce]);

  return { ...state, refresh };
}
