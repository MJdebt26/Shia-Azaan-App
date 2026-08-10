"use client";

import { compassPoint, qiblaBearing, qiblaDistanceKm } from "@/lib/prayer/qibla";
import { Callout, Card } from "@/components/ui/Controls";
import { IconCompass, IconInfo, IconWarn } from "@/components/ui/Icon";
import type { Loc } from "@/lib/types";

interface QiblaViewProps {
  loc: Loc;
  heading: number | null;
  supported: boolean;
  needsPermission: boolean;
  error: string | null;
  onEnable: () => void;
}

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

/**
 * The Qibla compass.
 *
 * When a live heading is available the whole dial counter-rotates so the gold
 * arrow points at the real Kaaba direction; without one, the arrow shows the
 * bearing from true north and the user aligns it themselves.
 */
export function QiblaView({
  loc,
  heading,
  supported,
  needsPermission,
  error,
  onEnable,
}: QiblaViewProps) {
  const bearing = qiblaBearing(loc.lat, loc.lng);
  const distance = qiblaDistanceKm(loc.lat, loc.lng);
  const live = heading != null;
  const dialRotation = live ? -heading : 0;
  const needleRotation = bearing + dialRotation;
  const aligned = live && Math.abs(((needleRotation + 540) % 360) - 180) > 172;

  return (
    <div className="space-y-4">
      <Card label="Qibla">
        <div className="flex flex-col items-center py-2">
          <div className="relative h-[220px] w-[220px] select-none">
            {/* Rotating dial */}
            <div
              className="compass-needle absolute inset-0 rounded-full"
              style={{ transform: `rotate(${dialRotation}deg)` }}
            >
              <div className="compass-ring absolute inset-0 rounded-full" />
              {TICKS.map((deg) => {
                const major = deg % 45 === 0;
                return (
                  <span
                    key={deg}
                    aria-hidden="true"
                    className={`absolute left-1/2 top-[6px] origin-[50%_104px] ${
                      major ? "h-2.5 w-[1.5px] bg-muted" : "h-1.5 w-px bg-faint/45"
                    }`}
                    style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
                  />
                );
              })}
              {(["N", "E", "S", "W"] as const).map((label, i) => (
                <span
                  key={label}
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[18px] origin-[50%_92px] text-[11px] font-extrabold tracking-wider ${
                    label === "N" ? "text-critical" : "text-faint"
                  }`}
                  style={{
                    transform: `translateX(-50%) rotate(${i * 90}deg)`,
                  }}
                >
                  <span
                    style={{ display: "inline-block", transform: `rotate(${-i * 90 - dialRotation}deg)` }}
                  >
                    {label}
                  </span>
                </span>
              ))}
            </div>

            {/* Qibla needle */}
            <div
              className="compass-needle absolute inset-0"
              style={{ transform: `rotate(${needleRotation}deg)` }}
            >
              <svg
                viewBox="0 0 24 220"
                className="absolute left-1/2 top-0 h-full w-6 -translate-x-1/2 overflow-visible"
                aria-hidden="true"
              >
                <path
                  d="M12 14 L19 40 L12 34 L5 40 Z"
                  fill={aligned ? "rgb(var(--c-positive))" : "rgb(var(--c-accent))"}
                />
                <line
                  x1="12" y1="34" x2="12" y2="110"
                  stroke={aligned ? "rgb(var(--c-positive))" : "rgb(var(--c-accent))"}
                  strokeWidth="2"
                  strokeOpacity="0.5"
                />
              </svg>
            </div>

            {/* Kaaba pip */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-accent shadow-[0_0_0_4px_rgb(var(--c-accent)/0.16)]"
            />
          </div>

          <p className="tnum mt-4 text-[30px] font-bold leading-none text-accent-bright">
            {bearing.toFixed(1)}°
          </p>
          <p className="mt-1.5 text-[13px] font-medium text-muted">
            {compassPoint(bearing)} · {Math.round(distance).toLocaleString()} km to Makkah
          </p>

          {aligned && (
            <p className="mt-2 rounded-full bg-positive/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-positive">
              Facing the Qibla
            </p>
          )}

          {needsPermission && supported && (
            <div className="mt-4 w-full">
              <button
                type="button"
                onClick={onEnable}
                className="btn btn-primary w-full"
              >
                <IconCompass size={17} />
                Enable live compass
              </button>
              {/* iOS shows its own permission sheet; say so, or the extra
                  prompt looks like the app misfiring. */}
              <p className="mt-2 text-[11px] leading-snug text-faint">
                Your device will ask for motion &amp; orientation access. Until
                then the bearing above is still correct — it just will not
                follow you as you turn.
              </p>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Callout tone="warn" icon={<IconWarn size={15} />}>
          {error}
        </Callout>
      )}

      <Callout icon={<IconInfo size={15} />}>
        {live ? (
          <>
            Live heading is active — turn until the arrow points straight up.
            Phone compasses drift near metal and electronics; if the needle looks
            wrong, move away and wave the phone in a figure-of-eight to
            recalibrate.
          </>
        ) : supported ? (
          <>
            Point the top of your phone toward true north, then face{" "}
            <strong>{bearing.toFixed(0)}°</strong> ({compassPoint(bearing)}).
            Note that magnetic north differs from true north in most places.
          </>
        ) : (
          <>
            This device has no compass, so the arrow shows the bearing from{" "}
            <strong>true north</strong>: {bearing.toFixed(0)}° (
            {compassPoint(bearing)}).
          </>
        )}
      </Callout>
    </div>
  );
}
