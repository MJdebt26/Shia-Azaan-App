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

/** Signed turn to face `target` from `from`: negative = left, positive = right. */
function turnTo(from: number, target: number): number {
  const d = ((target - from + 540) % 360) - 180;
  return d;
}

/**
 * The Qibla compass.
 *
 * The dial carries the cardinal ring and rotates so N really points north; the
 * gold arrow rides it at the true Qibla bearing. On its own that reads as "the
 * whole thing spins", so there is a **fixed index at the top** — the direction
 * you are actually facing. You turn until the arrow meets the index. That is
 * the same arrangement as a physical compass and as Apple's Compass app, and it
 * gives the eye something stationary to judge the motion against.
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
  const turn = live ? turnTo(heading, bearing) : 0;
  const aligned = live && Math.abs(turn) <= 5;

  return (
    <div className="space-y-4">
      <Card label="Qibla">
        <div className="flex flex-col items-center py-2">
          <div className="relative h-[240px] w-[240px] select-none">
            {/*
              The fixed index. Outside the rotating dial and never transformed,
              so it is the one thing on screen that stays put.
            */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 z-20 -translate-x-1/2"
            >
              <svg width="20" height="14" viewBox="0 0 20 14">
                <path
                  d="M10 14 L2 0 L18 0 Z"
                  fill={
                    aligned
                      ? "rgb(var(--c-positive))"
                      : "rgb(var(--c-text-muted))"
                  }
                />
              </svg>
            </div>

            {/* Rotating dial: cardinal ring + ticks */}
            <div
              className="compass-needle absolute inset-[10px] rounded-full"
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
                      major ? "h-2.5 w-[1.5px] bg-muted" : "h-1.5 w-px bg-faint/40"
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
                  style={{ transform: `translateX(-50%) rotate(${i * 90}deg)` }}
                >
                  {/* Counter-rotate so the letters stay upright as the dial turns. */}
                  <span
                    style={{
                      display: "inline-block",
                      transform: `rotate(${-i * 90 - dialRotation}deg)`,
                    }}
                  >
                    {label}
                  </span>
                </span>
              ))}
            </div>

            {/* The Qibla arrow — the thing the eye should follow. */}
            <div
              className="compass-needle absolute inset-[10px]"
              style={{ transform: `rotate(${needleRotation}deg)` }}
            >
              <svg
                viewBox="0 0 24 220"
                className="absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="qibla-arrow" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={
                        aligned
                          ? "rgb(var(--c-positive))"
                          : "rgb(var(--c-accent-bright))"
                      }
                    />
                    <stop
                      offset="100%"
                      stopColor={
                        aligned
                          ? "rgb(var(--c-positive))"
                          : "rgb(var(--c-accent))"
                      }
                    />
                  </linearGradient>
                </defs>
                <path
                  d="M12 10 L20 40 L12 33 L4 40 Z"
                  fill="url(#qibla-arrow)"
                />
                <line
                  x1="12" y1="33" x2="12" y2="106"
                  stroke="url(#qibla-arrow)"
                  strokeWidth="2.5"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Kaaba pip at the pivot */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-accent shadow-[0_0_0_5px_rgb(var(--c-accent)/0.16)]"
            />
          </div>

          <p className="tnum mt-4 text-[30px] font-bold leading-none text-accent-bright">
            {bearing.toFixed(1)}°
          </p>
          <p className="mt-1.5 text-[13px] font-medium text-muted">
            {compassPoint(bearing)} · {Math.round(distance).toLocaleString()} km to Makkah
          </p>

          {/* The instruction that makes the dial legible. */}
          {live && (
            <p
              aria-live="polite"
              className={`mt-3 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider ${
                aligned
                  ? "bg-positive/15 text-positive"
                  : "bg-accent/12 text-accent-bright"
              }`}
            >
              {aligned
                ? "Facing the Qibla"
                : `Turn ${Math.abs(turn) < 1 ? "" : Math.round(Math.abs(turn)) + "° "}${turn > 0 ? "right" : "left"}`}
            </p>
          )}

          {/* `!live` guards the case where readings are already arriving: once
              there is a heading, asking for permission is noise. */}
          {needsPermission && supported && !live && (
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
            Turn until the gold arrow meets the marker at the top. Phone
            compasses drift near metal and electronics; if the arrow looks wrong,
            move away and wave the phone in a figure-of-eight to recalibrate.
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
