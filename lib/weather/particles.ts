import type { Intensity, WeatherKind } from "./types";

/**
 * Precipitation physics, with no canvas in sight.
 *
 * Kept pure and injectable-random so the behaviour that actually matters —
 * how many particles, how fast they fall, how far the wind pushes them, and
 * whether they recycle correctly — can be unit-tested. The component is then
 * only responsible for turning these numbers into strokes.
 */

export interface Particle {
  x: number;
  y: number;
  /** 0–1: how "near" the particle is. Drives parallax, size and speed. */
  depth: number;
  /** Pixels per second, already scaled by depth. */
  speed: number;
  /** Snow only: phase of the horizontal sway. */
  phase: number;
  radius: number;
  length: number;
}

export interface FieldConfig {
  kind: WeatherKind;
  intensity: Intensity;
  width: number;
  height: number;
  /** Wind speed in km/h. */
  wind: number;
}

/** Injectable so tests are deterministic; defaults to Math.random. */
export type Rng = () => number;

/** Particles per 100 000 px², by kind and intensity. */
const DENSITY: Partial<Record<WeatherKind, Record<Intensity, number>>> = {
  drizzle: { light: 26, moderate: 40, heavy: 55 },
  rain: { light: 45, moderate: 78, heavy: 120 },
  sleet: { light: 34, moderate: 52, heavy: 74 },
  snow: { light: 22, moderate: 38, heavy: 60 },
  hail: { light: 30, moderate: 46, heavy: 66 },
  thunderstorm: { light: 80, moderate: 110, heavy: 145 },
};

/** Hard ceiling: past this the frame cost stops being free on a phone. */
export const MAX_PARTICLES = 360;

export function isSnowy(kind: WeatherKind): boolean {
  return kind === "snow";
}

/** Fall speed in px/s at depth 1, before the depth multiplier. */
export function baseSpeed(kind: WeatherKind): number {
  switch (kind) {
    case "snow":
      return 70;
    case "sleet":
      return 260;
    case "drizzle":
      return 300;
    case "hail":
      return 620;
    case "thunderstorm":
      return 700;
    default:
      return 520; // rain
  }
}

/** How many particles this surface should hold. Zero for dry conditions. */
export function particleCount(cfg: FieldConfig): number {
  const table = DENSITY[cfg.kind];
  if (!table || cfg.width <= 0 || cfg.height <= 0) return 0;
  const area = (cfg.width * cfg.height) / 100_000;
  return Math.round(Math.min(MAX_PARTICLES, area * table[cfg.intensity]));
}

/**
 * Horizontal push in px/s at depth 1. Snow is moved less in absolute terms
 * because it also sways, and doubling both reads as a glitch rather than wind.
 */
export function slantFor(kind: WeatherKind, wind: number): number {
  const w = Number.isFinite(wind) ? Math.max(0, wind) : 0;
  return (w / 40) * (isSnowy(kind) ? 90 : 150);
}

/**
 * @param initial true when filling an empty field: particles are scattered
 *   through the full height so the first frame is not one curtain at the top.
 */
export function createParticle(
  cfg: FieldConfig,
  rng: Rng = Math.random,
  initial = false,
): Particle {
  const depth = 0.35 + rng() * 0.65;
  const snowy = isSnowy(cfg.kind);
  return {
    x: rng() * cfg.width,
    y: initial ? rng() * cfg.height : -12 - rng() * 40,
    depth,
    speed: baseSpeed(cfg.kind) * (0.6 + depth * 0.6),
    phase: rng() * Math.PI * 2,
    radius: snowy ? 0.8 + depth * 2.0 : 0.5 + depth * 1.1,
    length: 6 + depth * 16,
  };
}

export function createField(cfg: FieldConfig, rng: Rng = Math.random): Particle[] {
  return Array.from({ length: particleCount(cfg) }, () =>
    createParticle(cfg, rng, true),
  );
}

/**
 * Advance one particle by `dt` seconds, recycling it to the top once it leaves
 * the surface. Mutates in place — this runs up to 360 times per frame and
 * allocating a replacement object each time is exactly the kind of garbage that
 * shows up as jank.
 */
export function stepParticle(
  p: Particle,
  cfg: FieldConfig,
  dt: number,
  rng: Rng = Math.random,
): void {
  const slant = slantFor(cfg.kind, cfg.wind);
  p.y += p.speed * dt;
  p.x += slant * p.depth * dt;

  if (isSnowy(cfg.kind)) {
    // Sine sway is what makes a flake read as a flake and not a falling dot.
    p.phase += dt * 1.1;
    p.x += Math.sin(p.phase) * 42 * dt * p.depth;
  }

  if (p.y > cfg.height + 20 || p.x < -60 || p.x > cfg.width + 60) {
    Object.assign(p, createParticle(cfg, rng, false));
  }
}

export function stepField(
  particles: Particle[],
  cfg: FieldConfig,
  dt: number,
  rng: Rng = Math.random,
): void {
  for (const p of particles) stepParticle(p, cfg, dt, rng);
}

/** The two endpoints of a rain streak, along its true velocity vector. */
export function streakEndpoints(
  p: Particle,
  cfg: FieldConfig,
): { x1: number; y1: number; x2: number; y2: number } {
  const vx = slantFor(cfg.kind, cfg.wind) * p.depth;
  const vy = p.speed;
  const mag = Math.hypot(vx, vy) || 1;
  const len = p.length * (cfg.kind === "drizzle" ? 0.55 : 1);
  return {
    x1: p.x,
    y1: p.y,
    x2: p.x - (vx / mag) * len,
    y2: p.y - (vy / mag) * len,
  };
}
