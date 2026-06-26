"use client";

import { useEffect, useRef, useState } from "react";
import { searchCities, type City } from "@/lib/cities";

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  locating: boolean;
  gpsError: string | null;
  onUseGPS: () => void;
  onSelectCity: (city: City) => void;
}

export function LocationSheet({
  open,
  onClose,
  locating,
  gpsError,
  onUseGPS,
  onSelectCity,
}: LocationSheetProps) {
  const [q, setQ] = useState("");
  const results = searchCities(q);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on Escape, and focus the search field when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => searchRef.current?.focus(), 300);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`sheet-bg ${open ? "show" : ""}`} onClick={onClose} />
      <div
        className={`sheet ${open ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Choose your location"
        aria-hidden={!open}
      >
        <div className="grab" />
        <h3>Your location</h3>
        <div className="sh-sub">Prayer times depend on exactly where you are.</div>

        <button className="gpsbtn" onClick={onUseGPS} disabled={locating}>
          <span>{locating ? "◌" : "📍"}</span>{" "}
          {locating ? "Locating…" : "Use my current location"}
        </button>
        {gpsError && <div className="gpserr show">{gpsError}</div>}

        <div className="searchbox">
          <span className="ico">🔍</span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search a city…"
            autoComplete="off"
            aria-label="Search a city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="results">
          {results.length ? (
            results.map((c) => (
              <button
                type="button"
                key={`${c.name}-${c.country}`}
                className="cityrow"
                onClick={() => {
                  onSelectCity(c);
                  setQ("");
                }}
              >
                <span className="c">{c.name}</span>
                <span className="cc">{c.country}</span>
              </button>
            ))
          ) : (
            <div className="cityrow">
              <span className="cc">No match — try the GPS button above.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
