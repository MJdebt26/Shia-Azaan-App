"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findNearestCity } from "@/lib/cities";
import type { Loc } from "@/lib/types";

/**
 * Turning a browser GPS fix into a `Loc`.
 *
 * Two decisions are baked in here:
 *
 *  - **`tz` is always null.** A GPS fix means the device is physically at that
 *    spot, so the device's own UTC offset is the right one — and it is right
 *    through DST changes without shipping a coordinate→timezone database.
 *    A saved *city*, by contrast, carries an explicit IANA zone because you may
 *    be looking it up from the other side of the world.
 *
 *  - **The place name is never load-bearing.** Reverse geocoding is a nicety
 *    for the header; the times come from the raw coordinates. So when the
 *    network call fails — offline, blocked by a content blocker, captive
 *    portal — we fall back to the nearest city in the built-in list instead of
 *    failing the whole request.
 */

export interface GeoFix {
  loc: Loc;
  /** Horizontal accuracy of the fix in metres, as reported by the device. */
  accuracyMetres: number;
  /** True when the name came from the offline city list, not a geocoder. */
  approximateName: boolean;
}

export interface UseGeolocation {
  locating: boolean;
  error: string | null;
  /** The most recent successful fix, kept so the UI can show "±35 m". */
  fix: GeoFix | null;
  /** False when the browser has no geolocation API or the page is insecure. */
  supported: boolean;
  /**
   * Ask for a fix. Resolves with the result, and also calls `onResult` if
   * given, so both `await request()` and `request(setLoc)` work.
   */
  request: (onResult?: (loc: Loc) => void) => Promise<GeoFix | null>;
  clearError: () => void;
}

/** BigDataCloud's key-less reverse geocoder; only the fields we use. */
interface ReverseGeocode {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

const GEOCODE_ENDPOINT =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";

/** Longer than this and the offline fallback is the better experience. */
const GEOCODE_TIMEOUT_MS = 5000;

const POSITION_OPTIONS: PositionOptions = {
  // Prayer times need ~1 km; the extra seconds and battery of a high-accuracy
  // fix buy nothing, and on a cold GPS they buy a timeout instead.
  enableHighAccuracy: false,
  timeout: 15_000,
  // A fix from the last 10 minutes is more than good enough and returns
  // instantly.
  maximumAge: 600_000,
};

function messageForError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location access is blocked. Allow it for this site in your browser settings (tap the padlock in the address bar), or choose your city from the list instead.";
    case err.POSITION_UNAVAILABLE:
      return "Your device couldn't work out where it is. Move somewhere with a clearer view of the sky or turn Wi-Fi on, then try again — or choose your city from the list.";
    case err.TIMEOUT:
      return "Finding your location took too long. Try again, or choose your city from the list.";
    default:
      return "Couldn't get your location. Choose your city from the list instead.";
  }
}

/**
 * Name a coordinate, preferring a real geocode and degrading to the nearest
 * bundled city so an offline GPS fix is still labelled something human.
 */
async function describe(
  lat: number,
  lng: number,
): Promise<{ name: string; country: string; approximate: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url = `${GEOCODE_ENDPOINT}?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = (await res.json()) as ReverseGeocode;
    const name = data.city || data.locality || data.principalSubdivision;
    if (name) {
      return { name, country: data.countryName ?? "", approximate: false };
    }
    throw new Error("geocode returned no place name");
  } catch {
    const nearest = findNearestCity(lat, lng);
    return {
      name: nearest.city.name,
      country: nearest.city.country,
      approximate: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function useGeolocation(): UseGeolocation {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<GeoFix | null>(null);
  // Geolocation needs a secure context; on plain http the API is either absent
  // or permanently denied, and saying so is more useful than "denied".
  const [supported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      "geolocation" in navigator &&
      (typeof window === "undefined" || window.isSecureContext !== false),
  );

  // The reverse-geocode leg is async, so a fix can land after the user has
  // navigated away from the sheet that asked for it.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const request = useCallback(
    (onResult?: (loc: Loc) => void): Promise<GeoFix | null> =>
      new Promise<GeoFix | null>((resolve) => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
          setError(
            "This browser can't share your location. Choose your city from the list instead.",
          );
          resolve(null);
          return;
        }
        if (typeof window !== "undefined" && window.isSecureContext === false) {
          setError(
            "Location only works over a secure (https) connection. Choose your city from the list instead.",
          );
          resolve(null);
          return;
        }

        setLocating(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const place = await describe(latitude, longitude);
            const result: GeoFix = {
              loc: {
                name: place.name,
                country: place.country,
                lat: latitude,
                lng: longitude,
                tz: null,
                source: "gps",
              },
              accuracyMetres: Number.isFinite(accuracy) ? accuracy : 0,
              approximateName: place.approximate,
            };
            if (alive.current) {
              setFix(result);
              setLocating(false);
            }
            onResult?.(result.loc);
            resolve(result);
          },
          (err) => {
            if (alive.current) {
              setLocating(false);
              setError(messageForError(err));
            }
            resolve(null);
          },
          POSITION_OPTIONS,
        );
      }),
    [],
  );

  return { locating, error, fix, supported, request, clearError };
}
