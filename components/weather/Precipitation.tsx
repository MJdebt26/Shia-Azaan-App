"use client";

import { useEffect, useRef } from "react";
import {
  createField,
  isSnowy,
  stepField,
  streakEndpoints,
  type FieldConfig,
  type Particle,
} from "@/lib/weather/particles";
import type { Intensity, WeatherKind } from "@/lib/weather/types";

/**
 * Canvas precipitation.
 *
 * Drawn on a canvas rather than with DOM nodes because heavy rain is ~260
 * particles at 60fps: trivial for one canvas, ruinous for 260 positioned divs.
 * The motion itself lives in `lib/weather/particles.ts` so it can be tested;
 * this file is only the plumbing.
 *
 * What keeps it from being a battery bug:
 *   - it stops when the tab is hidden or the hero scrolls out of view;
 *   - under `prefers-reduced-motion` it paints one still frame and stops;
 *   - particle counts scale with the element's area, not the viewport's.
 */

interface PrecipitationProps {
  kind: WeatherKind;
  intensity: Intensity;
  /** Drives how far the particles slant. */
  windKph: number;
  className?: string;
}

export function Precipitation({
  kind,
  intensity,
  windKph,
  className,
}: PrecipitationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Wind changes shouldn't restart the animation, so it is read through a ref.
  const windRef = useRef(windKph);
  useEffect(() => {
    windRef.current = windKph;
  }, [windKph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let cfg: FieldConfig = {
      kind,
      intensity,
      width: 0,
      height: 0,
      wind: windRef.current,
    };
    let particles: Particle[] = [];
    let frame = 0;
    let last = 0;
    let pageVisible = !document.hidden;
    let onScreen = true;
    /** False until the element has had a real, non-zero size at least once. */
    let sized = false;

    const paint = (): void => {
      const snowy = isSnowy(cfg.kind);
      ctx.clearRect(0, 0, cfg.width, cfg.height);

      for (const p of particles) {
        if (snowy) {
          ctx.globalAlpha = 0.25 + p.depth * 0.6;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (cfg.kind === "hail") {
          ctx.globalAlpha = 0.4 + p.depth * 0.5;
          ctx.fillStyle = "#DCE6F2";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const { x1, y1, x2, y2 } = streakEndpoints(p, cfg);
          ctx.globalAlpha = 0.18 + p.depth * 0.42;
          ctx.strokeStyle = "#C9D8EC";
          ctx.lineWidth = p.radius;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      // A hero that mounts before layout reports 0×0. Bail, but stay observed:
      // the ResizeObserver below will call back the moment it has a real size.
      if (rect.width < 1 || rect.height < 1) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cfg = { ...cfg, width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = createField(cfg);
      sized = true;

      // Reduced motion gets its one still frame here rather than never, which
      // is what happens if you only paint on the first (zero-sized) pass.
      if (reduceMotion) paint();
      else start();
    };

    const tick = (now: number): void => {
      if (!pageVisible || !onScreen || !sized) {
        frame = 0;
        return;
      }
      // Clamp dt so returning to a backgrounded tab does not teleport the field.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      cfg.wind = windRef.current;
      stepField(particles, cfg, dt);
      paint();
      frame = requestAnimationFrame(tick);
    };

    function start(): void {
      if (frame || reduceMotion || !pageVisible || !onScreen || !sized) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    const stop = (): void => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onVisibility = (): void => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };

    // Observers are set up unconditionally — including under reduced motion —
    // so an element that starts at zero size always recovers.
    const intersection = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    intersection.observe(canvas);

    const resize = new ResizeObserver(() => measure());
    resize.observe(canvas);

    document.addEventListener("visibilitychange", onVisibility);
    measure();

    return () => {
      stop();
      intersection.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Kind and intensity change the particle shape and count, so the field is
    // rebuilt; wind is handled through the ref above without a restart.
  }, [kind, intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
