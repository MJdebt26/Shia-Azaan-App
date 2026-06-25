"use client";

import { useCallback, useState } from "react";
import type { Loc } from "@/lib/types";

interface GeoState {
  locating: boolean;
  error: string | null;
}

interface BigDataCloud {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/**
 * Browser geolocation with a free, key-less reverse-geocode for the city name.
 * Returns a Loc with `tz: null` so prayer times use the device's own offset —
 * which is correct, because the device is physically at that location.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ locating: false, error: null });

  const request = useCallback((onResult: (loc: Loc) => void) => {
    setState({ locating: true, error: null });

    if (!("geolocation" in navigator)) {
      setState({
        locating: false,
        error: "Geolocation isn't available in this browser. Pick a city below.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let name = "My location";
        let country = "";
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
          );
          const j: BigDataCloud = await res.json();
          name = j.city || j.locality || j.principalSubdivision || "My location";
          country = j.countryName || "";
        } catch {
          /* keep generic name if reverse geocode fails */
        }
        setState({ locating: false, error: null });
        onResult({ name, country, lat, lng, tz: null });
      },
      (err) => {
        setState({
          locating: false,
          error:
            err.code === 1
              ? "Location permission was denied. You can pick a city below instead."
              : "Couldn't get your location. Pick a city below.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  return { ...state, request };
}
