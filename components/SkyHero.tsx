"use client";

import { useMemo } from "react";
import { altitude } from "@/lib/prayer";
import { PRAYERS } from "@/lib/constants";
import type { FormattedTime, PrayerMeta, Times } from "@/lib/types";

const W = 1000;
const H = 200;
const HORIZON = 140;
const SCALE = 1.7;

const yFor = (alt: number) => Math.max(12, Math.min(196, HORIZON - alt * SCALE));

type Pt = [number, number];

function toPath(pts: Pt[]): string {
  return pts.length
    ? "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")
    : "";
}

// Break a point list into continuous segments (the daylit arc can wrap).
function segs(pts: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let lastX = -99;
  for (const p of pts) {
    if (p[0] - lastX > 40 && cur.length) {
      out.push(cur);
      cur = [];
    }
    cur.push(p);
    lastX = p[0];
  }
  if (cur.length) out.push(cur);
  return out;
}

interface SkyHeroProps {
  skyColors: [string, string, string];
  starsOn: boolean;
  nextLabel: string;
  nextMeta: PrayerMeta;
  nextTime: FormattedTime;
  countdown: string;
  /** Fraction [0,1] elapsed through the current interval. */
  progress: number;
  // arc inputs
  lat: number;
  lng: number;
  off: number;
  dayKey: string;
  times: Times;
  currentIndex: number;
  nowH: number;
}

export function SkyHero({
  skyColors,
  starsOn,
  nextLabel,
  nextMeta,
  nextTime,
  countdown,
  progress,
  lat,
  lng,
  off,
  dayKey,
  times,
  currentIndex,
  nowH,
}: SkyHeroProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 70}%`,
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );

  // The sun path itself depends only on place + day — sample it once.
  const paths = useMemo(() => {
    const dObj = (() => {
      const [y, m, d] = dayKey.split("-").map(Number);
      return new Date(y, m - 1, d);
    })();
    const day: Pt[] = [];
    const night: Pt[] = [];
    for (let h = 0; h <= 24; h += 0.25) {
      const alt = altitude(dObj, lat, lng, off, h);
      const pt: Pt = [(h / 24) * W, yFor(alt)];
      (alt >= 0 ? day : night).push(pt);
    }
    return {
      day: segs(day).map(toPath).join(" "),
      night: segs(night).map(toPath).join(" "),
    };
  }, [lat, lng, off, dayKey]);

  const dObj = useMemo(() => {
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [dayKey]);

  const markers = PRAYERS.map((p, i) => {
    const h = times[p.key];
    const x = (h / 24) * W;
    const y = yFor(altitude(dObj, lat, lng, off, h));
    const isNext =
      i === currentIndex + 1 || (currentIndex === -1 && p.key === "fajr");
    const passed = i <= currentIndex;
    const cls = `pdot ${isNext ? "next" : ""} ${passed ? "passed" : ""}`.trim();
    return (
      <circle key={p.key} className={cls} cx={x.toFixed(1)} cy={y.toFixed(1)} r={isNext ? 4.5 : 3} />
    );
  });

  const nx = (nowH / 24) * W;
  const nAlt = altitude(dObj, lat, lng, off, nowH);
  const ny = yFor(nAlt);
  const isDay = nAlt >= -0.833;

  return (
    <div
      className="hero"
      style={
        {
          "--sky-a": skyColors[0],
          "--sky-b": skyColors[1],
          "--sky-c": skyColors[2],
        } as React.CSSProperties
      }
    >
      <div className="stars" style={{ opacity: starsOn ? 1 : 0 }}>
        {stars.map((s, i) => (
          <i key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
        ))}
      </div>

      <div className="hero-top">
        <div className="nextlabel">{nextLabel}</div>
        <div className="nextname">
          <span className="ar">{nextMeta.ar}</span>
          <span className="en">{nextMeta.en}</span>
        </div>
        <div className="herorow">
          <div className="attime">
            {nextTime.h}
            <span className="ap">{nextTime.ap}</span>
          </div>
          <div className="countpill">
            <div className="lab">Begins in</div>
            <div className="val">{countdown}</div>
          </div>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Progress to next prayer"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ width: `${(progress * 100).toFixed(1)}%` }} />
        </div>
      </div>

      <div className="arcwrap">
        <svg className="arc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="daygrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#E8B86A" stopOpacity=".4" />
              <stop offset="0.5" stopColor="#F4D696" stopOpacity=".95" />
              <stop offset="1" stopColor="#E0879A" stopOpacity=".5" />
            </linearGradient>
          </defs>
          <line className="horizon" x1="0" y1={HORIZON} x2={W} y2={HORIZON} />
          <path className="nightpath" d={paths.night} />
          <path className="daypath" d={paths.day} />
          <g>{markers}</g>
          <g>
            {isDay ? (
              <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="7" fill="#F4D696" className="nowglow" />
            ) : (
              <g className="nowglow" transform={`translate(${nx.toFixed(1)},${ny.toFixed(1)})`}>
                <path d="M5 -1.5A6 6 0 1 1 -2.5 -5.2A4.6 4.6 0 0 0 5 -1.5Z" fill="#D9E0F2" />
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
