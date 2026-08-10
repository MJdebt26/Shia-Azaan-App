"use client";

import { useEffect, useRef } from "react";
import {
  createField,
  gustAt,
  isSnowy,
  slantFor,
  stepField,
  type FieldConfig,
  type Particle,
} from "@/lib/weather/particles";
import type { Intensity, WeatherKind } from "@/lib/weather/types";

/**
 * Canvas precipitation.
 *
 * The first version drew hard-edged lines and circles, which is what made it
 * look like a screensaver rather than weather. Three things fix that, and they
 * are the same three Apple's version relies on:
 *
 *  1. **Soft sprites.** Every particle is a pre-rendered bitmap with a gradient
 *     falloff, drawn with `drawImage`, instead of a crisp `stroke()`. Real rain
 *     seen by a camera has motion blur; a 1px line never will. Pre-rendering
 *     once per depth band keeps it cheaper than the stroking it replaced.
 *  2. **Depth of field.** Three bands. The far one is small, dim and slow; the
 *     near one is large, bright and fast, and is drawn last so it passes in
 *     front. That parallax is what creates the sense of volume.
 *  3. **Gusts.** The wind surges and eases (`gustAt`) instead of blowing at a
 *     constant rate, so the field never settles into a visible loop.
 *
 * It still stops dead when the tab is hidden or the hero scrolls away, and
 * still paints a single still frame under `prefers-reduced-motion`.
 */

interface PrecipitationProps {
  kind: WeatherKind;
  intensity: Intensity;
  windKph: number;
  className?: string;
}

/** Depth bands, far to near. Drawn in order, so nearer particles overlap. */
const BANDS = 3;

/** Which band a particle belongs to, from its depth. */
function bandOf(depth: number): number {
  if (depth < 0.55) return 0;
  if (depth < 0.8) return 1;
  return 2;
}

type Sprite = HTMLCanvasElement;

/**
 * A rain streak: a vertical capsule with a gradient that fades out toward the
 * tail, so it reads as a drop in motion rather than a dash.
 */
function makeStreakSprite(
  length: number,
  width: number,
  alpha: number,
  dpr: number,
): Sprite {
  const pad = 2;
  const w = Math.max(2, Math.ceil((width + pad) * dpr));
  const h = Math.max(2, Math.ceil(length * dpr));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return c;

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(200,216,238,0)");
  grad.addColorStop(0.45, `rgba(206,222,244,${alpha * 0.5})`);
  grad.addColorStop(0.85, `rgba(226,238,255,${alpha})`);
  grad.addColorStop(1, `rgba(236,245,255,${alpha * 0.85})`);
  g.fillStyle = grad;

  const rw = Math.max(1, width * dpr);
  const x = (w - rw) / 2;
  // roundRect is widely supported now, but a missing one must not blank the
  // whole effect.
  if (typeof g.roundRect === "function") {
    g.beginPath();
    g.roundRect(x, 0, rw, h, rw / 2);
    g.fill();
  } else {
    g.fillRect(x, 0, rw, h);
  }
  return c;
}

/** A snowflake: a soft radial blob, brightest at the core. */
function makeFlakeSprite(radius: number, alpha: number, dpr: number): Sprite {
  const r = Math.max(1.2, radius) * dpr;
  const size = Math.ceil(r * 4);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;

  const mid = size / 2;
  const grad = g.createRadialGradient(mid, mid, 0, mid, mid, r * 1.9);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.4, `rgba(246,250,255,${alpha * 0.75})`);
  grad.addColorStop(1, "rgba(238,246,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Hail: a small hard-ish pellet, still with a soft rim. */
function makeHailSprite(radius: number, alpha: number, dpr: number): Sprite {
  const r = Math.max(1.2, radius) * dpr;
  const size = Math.ceil(r * 3.4);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const mid = size / 2;
  const grad = g.createRadialGradient(mid - r * 0.3, mid - r * 0.3, 0, mid, mid, r * 1.5);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.55, `rgba(214,230,248,${alpha * 0.9})`);
  grad.addColorStop(1, "rgba(200,220,244,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function Precipitation({
  kind,
  intensity,
  windKph,
  className,
}: PrecipitationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      gust: 1,
    };
    let particles: Particle[] = [];
    let sprites: Sprite[] = [];
    let dpr = 1;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    let pageVisible = !document.hidden;
    let onScreen = true;
    let sized = false;

    const snowy = () => isSnowy(cfg.kind);

    /** One sprite per depth band, sized for that band's typical particle. */
    const buildSprites = (): void => {
      const out: Sprite[] = [];
      for (let b = 0; b < BANDS; b++) {
        const t = (b + 0.6) / BANDS; // representative depth for the band
        if (snowy()) {
          out.push(makeFlakeSprite(0.8 + t * 2.4, 0.3 + t * 0.6, dpr));
        } else if (cfg.kind === "hail") {
          out.push(makeHailSprite(1 + t * 2.2, 0.45 + t * 0.5, dpr));
        } else {
          const len = (6 + t * 18) * (cfg.kind === "drizzle" ? 0.6 : 1);
          out.push(makeStreakSprite(len, 0.7 + t * 1.5, 0.22 + t * 0.5, dpr));
        }
      }
      sprites = out;
    };

    const paint = (): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cfg.width, cfg.height);

      const flake = snowy() || cfg.kind === "hail";
      // Slant angle shared by every streak this frame.
      const vx = slantFor(cfg.kind, cfg.wind) * (cfg.gust ?? 1);
      const angle = flake ? 0 : Math.atan2(vx, 1) * 0.5;

      // Far band first so near particles pass in front of it.
      for (let b = 0; b < BANDS; b++) {
        const sprite = sprites[b];
        if (!sprite) continue;
        const sw = sprite.width / dpr;
        const sh = sprite.height / dpr;

        for (const p of particles) {
          if (bandOf(p.depth) !== b) continue;

          if (flake) {
            ctx.drawImage(sprite, p.x - sw / 2, p.y - sh / 2, sw, sh);
          } else {
            // Rotate about the drop's head so the streak trails behind it.
            const drop = Math.atan2(vx * p.depth, p.speed);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(drop || angle);
            ctx.drawImage(sprite, -sw / 2, -sh, sw, sh);
            ctx.restore();
          }
        }
      }
    };

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cfg = { ...cfg, width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildSprites();
      particles = createField(cfg);
      sized = true;

      if (reduceMotion) paint();
      else start();
    };

    const tick = (now: number): void => {
      if (!pageVisible || !onScreen || !sized) {
        frame = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      cfg.wind = windRef.current;
      cfg.gust = gustAt(elapsed);
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
