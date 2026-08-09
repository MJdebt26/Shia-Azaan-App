"use client";

import { useMemo } from "react";
import {
  horizonDip,
  julianDay,
  solarNoon,
  sunAltitude,
  sunPosition,
} from "@/lib/prayer/astronomy";
import { PRAYERS } from "@/lib/constants";
import type { PrayerKey, Times } from "@/lib/types";

/**
 * The sun's altitude across the whole day, with the prayer times marked on it.
 *
 * This is the piece that makes the timetable legible at a glance: you can see
 * *why* Fajr is where it is, and how much daylight is left.
 */

const W = 1000;
const H = 210;
const HORIZON = 148;
const DEG_TO_PX = 1.75;

type Point = readonly [number, number];

const yForAltitude = (alt: number): number =>
  Math.max(10, Math.min(H - 8, HORIZON - alt * DEG_TO_PX));

function toPath(points: Point[]): string {
  if (!points.length) return "";
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
}

/** Split into continuous runs so the dashed night arc does not join across gaps. */
function segments(points: Point[]): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  let lastX = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (run.length && p[0] - lastX > W / 24) {
      out.push(run);
      run = [];
    }
    run.push(p);
    lastX = p[0];
  }
  if (run.length) out.push(run);
  return out;
}

interface SunArcProps {
  lat: number;
  lng: number;
  tzOffset: number;
  dayKey: string;
  times: Times;
  nowHours: number;
  currentKey: PrayerKey | null;
  nextKey: PrayerKey | null;
}

export function SunArc({
  lat,
  lng,
  tzOffset,
  dayKey,
  times,
  nowHours,
  currentKey,
  nextKey,
}: SunArcProps) {
  // The arc depends only on place + calendar day, so it is sampled once and
  // reused as the clock ticks.
  const { dayPath, nightPath, altitudeAt } = useMemo(() => {
    const [y, m, d] = dayKey.split("-").map(Number);
    const jdBase = julianDay(y, m, d) - lng / (15 * 24);

    const altAt = (hours: number): number => {
      const jd = jdBase + hours / 24;
      const { declination } = sunPosition(jd);
      const noon = solarNoon(jd) + (tzOffset - lng / 15);
      return sunAltitude(declination, lat, hours - noon);
    };

    const day: Point[] = [];
    const night: Point[] = [];
    for (let h = 0; h <= 24.0001; h += 0.2) {
      const alt = altAt(h);
      const point: Point = [(h / 24) * W, yForAltitude(alt)];
      (alt >= -horizonDip() ? day : night).push(point);
    }

    return {
      dayPath: segments(day).map(toPath).join(" "),
      nightPath: segments(night).map(toPath).join(" "),
      altitudeAt: altAt,
    };
  }, [lat, lng, tzOffset, dayKey]);

  const markers = PRAYERS.map((p) => {
    const hours = ((times[p.key] % 24) + 24) % 24;
    const x = (hours / 24) * W;
    const y = yForAltitude(altitudeAt(hours));
    const isNext = p.key === nextKey;
    const isCurrent = p.key === currentKey;
    return (
      <circle
        key={p.key}
        cx={x.toFixed(1)}
        cy={y.toFixed(1)}
        r={isNext ? 5 : 3.2}
        className={`arc-marker ${isNext ? "arc-marker--next" : ""} ${
          isCurrent ? "" : "arc-marker--passed"
        }`}
      >
        <title>{`${p.en} — ${String(Math.floor(hours)).padStart(2, "0")}:${String(
          Math.round((hours % 1) * 60),
        ).padStart(2, "0")}`}</title>
      </circle>
    );
  });

  const nowX = (nowHours / 24) * W;
  const nowAlt = altitudeAt(nowHours);
  const nowY = yForAltitude(nowAlt);
  const isDaylight = nowAlt >= -horizonDip();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-[104px] w-full sm:h-[124px]"
      role="img"
      aria-label={`Sun path for the day. The sun is currently ${
        isDaylight ? "above" : "below"
      } the horizon at ${nowAlt.toFixed(0)} degrees altitude.`}
    >
      <defs>
        <linearGradient id="awqat-day-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E8B86A" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#F4D696" stopOpacity="0.95" />
          <stop offset="1" stopColor="#E0879A" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <line className="arc-horizon" x1="0" y1={HORIZON} x2={W} y2={HORIZON} />
      <path className="arc-night" d={nightPath} />
      <path className="arc-day" d={dayPath} />
      {markers}

      {/* Current position of the sun (or the moon after dark). */}
      <g className="sun-glow">
        {isDaylight ? (
          <circle cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="7.5" fill="#F4D696" />
        ) : (
          <g transform={`translate(${nowX.toFixed(1)},${nowY.toFixed(1)})`}>
            <path
              d="M5 -1.6A6.2 6.2 0 1 1 -2.6 -5.4A4.8 4.8 0 0 0 5 -1.6Z"
              fill="#D9E0F2"
            />
          </g>
        )}
      </g>
    </svg>
  );
}
