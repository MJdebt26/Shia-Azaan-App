"use client";

import { useEffect, useState } from "react";
import { Precipitation } from "./Precipitation";
import { hasPrecipitation, type WeatherSnapshot } from "@/lib/weather/types";

/**
 * Everything the weather draws on top of the sky, in one layer.
 *
 * Sits between the sky gradient and the hero's text, and is entirely
 * decorative: `aria-hidden`, `pointer-events: none`, and every piece degrades to
 * nothing when there is no reading. The text above it never moves.
 */

interface WeatherLayerProps {
  weather: WeatherSnapshot | null;
  /** Solar darkness, so clouds are lit correctly at night. */
  night: boolean;
}

/**
 * Drifting cloud.
 *
 * Three bands at different depths, speeds and opacities. Each is built from
 * five overlapping radial blobs of varying size — a single ellipse blurs into
 * a smudge, whereas a lumpy silhouette still reads as cloud once blurred.
 * Daylight clouds are lit near-white; at night they are dim and slightly blue,
 * because an overcast night sky is a glow, not a highlight.
 */
function Clouds({ opacity, night }: { opacity: number; night: boolean }) {
  if (opacity <= 0.01) return null;

  const tint = night ? "184,198,224" : "255,255,255";

  const bands = [
    { top: "-6%", dur: "96s", alpha: night ? 0.1 : 0.26, scale: 1.35 },
    { top: "10%", dur: "68s", alpha: night ? 0.13 : 0.3, scale: 1 },
    { top: "30%", dur: "132s", alpha: night ? 0.07 : 0.17, scale: 1.7 },
  ];

  // Five blobs per band: sizes and offsets chosen to overlap unevenly.
  const blobs = [
    { w: 46, h: 150, x: 4, y: 52 },
    { w: 34, h: 120, x: 26, y: 38 },
    { w: 52, h: 165, x: 48, y: 58 },
    { w: 30, h: 108, x: 71, y: 40 },
    { w: 40, h: 132, x: 88, y: 55 },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
      aria-hidden="true"
    >
      {bands.map((band, i) => {
        const image = blobs
          .map(
            (_, j) =>
              `radial-gradient(closest-side, rgba(${tint},${(
                band.alpha *
                (1 - j * 0.09)
              ).toFixed(3)}) 0%, rgba(${tint},0) 100%)`,
          )
          .join(", ");
        const size = blobs
          .map((b) => `${b.w * band.scale}% ${b.h * band.scale}%`)
          .join(", ");
        const position = blobs.map((b) => `${b.x}% ${b.y}%`).join(", ");

        return (
          <div
            key={i}
            className="weather-cloud-band"
            style={{
              top: band.top,
              animationDuration: band.dur,
              // Offset each band's phase so they never line up.
              animationDelay: `${i * -19}s`,
              backgroundImage: image,
              backgroundSize: size,
              backgroundPosition: position,
            }}
          />
        );
      })}
    </div>
  );
}

/** Soft horizontal fog banks that breathe in and out. */
function Fog({ strength }: { strength: number }) {
  if (strength <= 0.01) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: strength }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="weather-fog-band"
          style={{
            top: `${18 + i * 26}%`,
            animationDuration: `${34 + i * 13}s`,
            animationDelay: `${i * -7}s`,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lightning.
 *
 * Fires on an irregular schedule — a fixed interval reads as a strobe, not as a
 * storm. Each strike is a short double-flash, which is what real lightning
 * looks like and what Apple's version does too.
 */
function Lightning({ active }: { active: boolean }) {
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: number;
    let cancelled = false;

    const strike = (): void => {
      if (cancelled) return;
      setFlash(1);
      window.setTimeout(() => !cancelled && setFlash(0.25), 70);
      window.setTimeout(() => !cancelled && setFlash(0.9), 150);
      window.setTimeout(() => !cancelled && setFlash(0), 260);
      // 6–20 s until the next one.
      timer = window.setTimeout(strike, 6000 + Math.random() * 14000);
    };

    timer = window.setTimeout(strike, 2500 + Math.random() * 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setFlash(0);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(226,238,255,0.85) 0%, rgba(190,214,255,0.25) 40%, rgba(0,0,0,0) 75%)",
        opacity: flash * 0.75,
        transition: "opacity 60ms linear",
        mixBlendMode: "screen",
      }}
    />
  );
}

export function WeatherLayer({ weather, night }: WeatherLayerProps) {
  if (!weather) return null;

  const { kind, intensity, windKph, cloudCover } = weather;

  // Cloud opacity tracks the actual reported cover, so "partly cloudy" is
  // visibly lighter than "overcast" instead of both being a generic haze.
  const cloudOpacity =
    kind === "fog"
      ? 0
      : Math.min(1, (cloudCover / 100) * (kind === "clear" ? 0.45 : 1));

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <Clouds opacity={cloudOpacity} night={night} />
      <Fog strength={kind === "fog" ? (intensity === "heavy" ? 0.95 : 0.7) : 0} />

      {hasPrecipitation(kind) && (
        <div className="absolute inset-0">
          <Precipitation
            kind={kind}
            intensity={intensity}
            windKph={windKph}
          />
        </div>
      )}

      <Lightning active={kind === "thunderstorm"} />
    </div>
  );
}
