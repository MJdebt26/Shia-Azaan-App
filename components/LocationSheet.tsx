"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./ui/Sheet";
import { Callout } from "./ui/Controls";
import { IconPin, IconSearch, IconWarn } from "./ui/Icon";
import { searchCities, type City } from "@/lib/cities";
import type { Loc } from "@/lib/types";

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  current: Loc;
  onSelect: (loc: Loc) => void;
  locating: boolean;
  error: string | null;
  onUseGPS: () => void;
}

export function LocationSheet({
  open,
  onClose,
  current,
  onSelect,
  locating,
  error,
  onUseGPS,
}: LocationSheetProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCities(query, 60), [query]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your location"
      description="Prayer times depend on exactly where you are."
      sticky={
        <div className="space-y-3">
          <button
            type="button"
            onClick={onUseGPS}
            disabled={locating}
            className="btn btn-primary w-full disabled:opacity-60"
          >
            <IconPin size={17} />
            {locating ? "Locating…" : "Use my current location"}
          </button>

          {error && (
            <Callout tone="warn" icon={<IconWarn size={15} />}>
              {error}
            </Callout>
          )}

          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <IconSearch size={17} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city…"
              aria-label="Search for a city"
              autoComplete="off"
              className="w-full rounded-xl border border-line-strong bg-surface-2 py-3 pl-11 pr-3 text-[16px] text-ink placeholder:text-faint/70"
            />
          </div>
        </div>
      }
    >
      {results.length > 0 ? (
        <ul className="pb-2" role="listbox" aria-label="Cities">
          {results.map((c: City) => {
            const active =
              c.name === current.name && c.country === current.country;
            return (
              <li key={`${c.name}-${c.country}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect({ ...c, source: "city" });
                    setQuery("");
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    active ? "bg-accent/10" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="truncate text-[14.5px] font-semibold">
                    {c.name}
                  </span>
                  <span className="flex-shrink-0 text-[11.5px] text-faint">
                    {c.country}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-[13px] text-faint">
          No city matches “{query}”. Try the location button above — it works
          anywhere, not just in listed cities.
        </p>
      )}
    </Sheet>
  );
}
