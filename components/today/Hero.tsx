"use client";

import { SunArc } from "./SunArc";
import { WeatherLayer } from "@/components/weather/WeatherLayer";
import { WeatherBadge } from "@/components/weather/WeatherBadge";
import { describeDuration, formatDuration, formatTime } from "@/lib/time";
import { PRAYER_BY_KEY } from "@/lib/constants";
import { skyColors, starsVisible, type SkyPhase } from "@/lib/sky";
import { starVisibility, tintSky } from "@/lib/weather/tint";
import type { WeatherSnapshot } from "@/lib/weather/types";
import type { PrayerKey, TimeFormat, Times } from "@/lib/types";

interface HeroProps {
  phase: SkyPhase;
  nextKey: PrayerKey;
  nextAt: Date;
  minutesUntil: number;
  /** Fraction [0,1] through the interval between the last prayer and the next. */
  progress: number;
  timeFormat: TimeFormat;
  nextHours: number;
  isFirstOfDay: boolean;
  // arc inputs
  lat: number;
  lng: number;
  tzOffset: number;
  dayKey: string;
  times: Times;
  nowHours: number;
  currentKey: PrayerKey | null;
  /** Live conditions, or null when disabled/unavailable. */
  weather: WeatherSnapshot | null;
  /** Temperature unit for the badge. */
  useCelsius: boolean;
}

interface Star {
  left: string;
  top: string;
  delay: string;
  scale: number;
}

/**
 * Deterministic star field.
 *
 * A seeded LCG rather than Math.random() so the server and the client generate
 * an identical field — random stars would mismatch on hydration and React
 * would discard the markup.
 */
function buildStars(count: number): Star[] {
  let seed = 20240321;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    left: `${(rand() * 100).toFixed(2)}%`,
    top: `${(rand() * 68).toFixed(2)}%`,
    delay: `${(rand() * 4).toFixed(2)}s`,
    scale: 0.6 + rand() * 0.9,
  }));
}

const STARS = buildStars(44);

export function Hero({
  phase,
  nextKey,
  nextAt,
  minutesUntil,
  progress,
  timeFormat,
  nextHours,
  isFirstOfDay,
  lat,
  lng,
  tzOffset,
  dayKey,
  times,
  nowHours,
  currentKey,
  weather,
  useCelsius,
}: HeroProps) {
  // Astronomy picks the hue; weather decides how much of it survives.
  const base = skyColors(phase);
  const colors = weather ? tintSky(base, weather.kind, phase) : base;

  const night = starsVisible(phase);
  // Cloud hides stars. A clear night keeps all of them, an overcast one none.
  const starAlpha = night
    ? weather
      ? starVisibility(weather.kind, weather.cloudCover)
      : 1
    : 0;

  const meta = PRAYER_BY_KEY[nextKey];
  const at = formatTime(nextHours, timeFormat);

  return (
    <section
      className="sky relative overflow-hidden rounded-3xl border border-line-strong shadow-lg"
      style={
        {
          "--sky-1": colors[0],
          "--sky-2": colors[1],
          "--sky-3": colors[2],
        } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: starAlpha }}
        aria-hidden="true"
      >
        {STARS.map((s, i) => (
          <i
            key={i}
            className="star"
            style={{
              left: s.left,
              top: s.top,
              animationDelay: s.delay,
              transform: `scale(${s.scale})`,
            }}
          />
        ))}
      </div>

      {/* Rain, snow, cloud, fog and lightning. Purely decorative. */}
      <WeatherLayer weather={weather} night={night} />

      <div className="relative z-10 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <p className="section-label opacity-95">
            {isFirstOfDay ? "Next · begins the day" : "Next prayer"}
          </p>
          <WeatherBadge weather={weather} useCelsius={useCelsius} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <span
            className="font-arabic text-[44px] leading-[0.92] text-ink sm:text-[52px]"
            style={{ textShadow: "0 2px 20px rgb(0 0 0 / 0.4)" }}
          >
            {meta.ar}
          </span>
          <span className="text-[17px] font-semibold text-muted">{meta.en}</span>
        </div>

        <div className="mt-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <p className="tnum text-[34px] font-light leading-none sm:text-[38px]">
            {at.time}
            {at.suffix && (
              <span className="ml-1 text-base font-semibold text-muted">
                {at.suffix}
              </span>
            )}
          </p>
          <div className="text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-faint">
              Begins in
            </p>
            <p
              className="tnum mt-0.5 text-[22px] font-bold leading-none text-accent-bright"
              aria-label={`${describeDuration(minutesUntil)} until ${meta.en}`}
            >
              {formatDuration(minutesUntil)}
            </p>
          </div>
        </div>

        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-ink/15"
          role="progressbar"
          aria-label={`Progress toward ${meta.en}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent-bright transition-[width] duration-1000 ease-linear"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
      </div>

      <div className="relative z-10 px-2 pb-3 pt-2">
        <SunArc
          lat={lat}
          lng={lng}
          tzOffset={tzOffset}
          dayKey={dayKey}
          times={times}
          nowHours={nowHours}
          currentKey={currentKey}
          nextKey={nextKey}
        />
      </div>

      <time className="sr-only" dateTime={nextAt.toISOString()}>
        {nextAt.toLocaleString()}
      </time>
    </section>
  );
}
