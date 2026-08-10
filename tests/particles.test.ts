import { describe, expect, it } from "vitest";
import {
  MAX_PARTICLES,
  baseSpeed,
  createField,
  createParticle,
  gustAt,
  particleCount,
  slantFor,
  stepField,
  stepParticle,
  streakEndpoints,
  type FieldConfig,
} from "@/lib/weather/particles";

/** Deterministic RNG so every assertion below is reproducible. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const cfg = (over: Partial<FieldConfig> = {}): FieldConfig => ({
  kind: "rain",
  intensity: "moderate",
  width: 360,
  height: 300,
  wind: 12,
  ...over,
});

describe("particle counts", () => {
  it("scales with area", () => {
    const small = particleCount(cfg({ width: 200, height: 150 }));
    const large = particleCount(cfg({ width: 800, height: 600 }));
    expect(large).toBeGreaterThan(small);
  });

  it("scales with intensity", () => {
    expect(particleCount(cfg({ intensity: "heavy" }))).toBeGreaterThan(
      particleCount(cfg({ intensity: "light" })),
    );
  });

  it("is zero for conditions that draw nothing", () => {
    for (const kind of ["clear", "cloudy", "overcast", "fog"] as const) {
      expect(particleCount(cfg({ kind }))).toBe(0);
    }
  });

  it("is zero at zero size — the case that mounts before layout", () => {
    expect(particleCount(cfg({ width: 0, height: 300 }))).toBe(0);
    expect(particleCount(cfg({ width: 360, height: 0 }))).toBe(0);
    expect(createField(cfg({ width: 0, height: 0 }))).toEqual([]);
  });

  it("never exceeds the ceiling, even on a huge surface", () => {
    const huge = particleCount(
      cfg({ width: 4000, height: 3000, kind: "thunderstorm", intensity: "heavy" }),
    );
    expect(huge).toBe(MAX_PARTICLES);
  });
});

describe("fall speeds", () => {
  it("orders the kinds the way real precipitation falls", () => {
    expect(baseSpeed("snow")).toBeLessThan(baseSpeed("drizzle"));
    expect(baseSpeed("drizzle")).toBeLessThan(baseSpeed("rain"));
    expect(baseSpeed("rain")).toBeLessThan(baseSpeed("hail"));
  });

  it("gives nearer particles more speed than distant ones", () => {
    const rng = seeded(7);
    const many = Array.from({ length: 40 }, () => createParticle(cfg(), rng));
    const near = many.filter((p) => p.depth > 0.8);
    const far = many.filter((p) => p.depth < 0.5);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(near.map((p) => p.speed))).toBeGreaterThan(
      avg(far.map((p) => p.speed)),
    );
  });
});

describe("wind", () => {
  it("pushes harder as it blows harder", () => {
    expect(slantFor("rain", 40)).toBeGreaterThan(slantFor("rain", 10));
    expect(slantFor("rain", 0)).toBe(0);
  });

  it("moves snow less in absolute terms, since it also sways", () => {
    expect(slantFor("snow", 40)).toBeLessThan(slantFor("rain", 40));
  });

  it("treats a missing or negative reading as calm", () => {
    expect(slantFor("rain", NaN)).toBe(0);
    expect(slantFor("rain", -30)).toBe(0);
  });

  it("blows particles downwind, not upwind", () => {
    const c = cfg({ wind: 30 });
    const rng = seeded(3);
    const p = createParticle(c, rng, true);
    const x0 = p.x;
    stepParticle(p, c, 0.1, rng);
    expect(p.x).toBeGreaterThan(x0);
  });
});

describe("stepping and recycling", () => {
  it("moves particles downward", () => {
    const c = cfg({ wind: 0 });
    const rng = seeded(11);
    const p = createParticle(c, rng, true);
    const y0 = p.y;
    stepParticle(p, c, 0.1, rng);
    expect(p.y).toBeGreaterThan(y0);
  });

  it("recycles a particle that falls off the bottom back to the top", () => {
    const c = cfg();
    const rng = seeded(5);
    const p = createParticle(c, rng, true);
    p.y = c.height + 100;
    stepParticle(p, c, 0.016, rng);
    expect(p.y).toBeLessThanOrEqual(0);
  });

  it("recycles a particle blown out of the side", () => {
    const c = cfg({ wind: 60 });
    const rng = seeded(9);
    const p = createParticle(c, rng, true);
    p.x = c.width + 500;
    stepParticle(p, c, 0.016, rng);
    expect(p.x).toBeLessThanOrEqual(c.width + 60);
  });

  it("keeps the field at a constant size over a long run", () => {
    const c = cfg();
    const rng = seeded(21);
    const field = createField(c, rng);
    const n = field.length;
    expect(n).toBeGreaterThan(0);
    // ~17 simulated seconds; every particle recycles many times over.
    for (let i = 0; i < 1000; i++) stepField(field, c, 0.016, rng);
    expect(field.length).toBe(n);
  });

  it("keeps every particle on or near the surface after a long run", () => {
    const c = cfg({ kind: "snow", wind: 25 });
    const rng = seeded(33);
    const field = createField(c, rng);
    for (let i = 0; i < 1500; i++) stepField(field, c, 0.016, rng);
    for (const p of field) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeLessThanOrEqual(c.height + 20);
      expect(p.x).toBeGreaterThanOrEqual(-60);
      expect(p.x).toBeLessThanOrEqual(c.width + 60);
    }
  });

  it("initial fill scatters through the whole height, not just the top", () => {
    const c = cfg();
    const field = createField(c, seeded(2));
    const ys = field.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(c.height * 0.35);
    expect(Math.max(...ys)).toBeGreaterThan(c.height * 0.6);
  });

  it("respawns above the surface so particles enter from off-screen", () => {
    const p = createParticle(cfg(), seeded(4), false);
    expect(p.y).toBeLessThan(0);
  });
});

describe("streak geometry", () => {
  it("draws the tail behind the direction of travel", () => {
    const c = cfg({ wind: 30 });
    const p = createParticle(c, seeded(6), true);
    const { x1, y1, x2, y2 } = streakEndpoints(p, c);
    // The tail is up-wind and above: the drop is heading down and to the right.
    expect(y2).toBeLessThan(y1);
    expect(x2).toBeLessThan(x1);
  });

  it("produces a finite streak of roughly the particle's length", () => {
    const c = cfg({ wind: 0 });
    const p = createParticle(c, seeded(8), true);
    const { x1, y1, x2, y2 } = streakEndpoints(p, c);
    const len = Math.hypot(x2 - x1, y2 - y1);
    expect(len).toBeCloseTo(p.length, 5);
  });

  it("shortens drizzle relative to rain", () => {
    const rainCfg = cfg({ kind: "rain", wind: 0 });
    const drizzleCfg = cfg({ kind: "drizzle", wind: 0 });
    const a = createParticle(rainCfg, seeded(1), true);
    const b = { ...a };
    const ra = streakEndpoints(a, rainCfg);
    const rb = streakEndpoints(b, drizzleCfg);
    expect(Math.hypot(rb.x2 - rb.x1, rb.y2 - rb.y1)).toBeLessThan(
      Math.hypot(ra.x2 - ra.x1, ra.y2 - ra.y1),
    );
  });
});

describe("wind gusts", () => {
  it("stays within sane bounds over a long run", () => {
    for (let t = 0; t < 600; t += 0.37) {
      const g = gustAt(t);
      expect(g).toBeGreaterThanOrEqual(0.55);
      expect(g).toBeLessThanOrEqual(1.45);
    }
  });

  it("actually varies — a constant would look fake", () => {
    const samples = Array.from({ length: 200 }, (_, i) => gustAt(i * 0.5));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min).toBeGreaterThan(0.4);
  });

  it("does not repeat on a short, visible cycle", () => {
    // Two incommensurable periods, so t and t+17s should differ.
    for (const t of [3, 11, 29, 47]) {
      expect(Math.abs(gustAt(t) - gustAt(t + 17))).toBeGreaterThan(0.01);
    }
  });

  it("scales the slant it is applied to", () => {
    const base = slantFor("rain", 40);
    const cfgCalm = { kind: "rain", intensity: "moderate", width: 300, height: 300, wind: 40, gust: 0.6 } as const;
    const cfgGusty = { ...cfgCalm, gust: 1.4 } as const;
    const p = createParticle(cfgCalm, () => 0.5, true);
    const calm = { ...p };
    const gusty = { ...p };
    stepParticle(calm, cfgCalm, 0.1, () => 0.5);
    stepParticle(gusty, cfgGusty, 0.1, () => 0.5);
    expect(gusty.x - p.x).toBeGreaterThan(calm.x - p.x);
    expect(base).toBeGreaterThan(0);
  });
});
