import { describe, expect, it } from "vitest";
import { decodeWmo, refineByCloudCover } from "@/lib/weather/codes";
import { parseCurrent, coarsen } from "@/lib/weather/client";
import { hexToRgb, rgbToHex, starVisibility, tintColor, tintSky } from "@/lib/weather/tint";
import { prefersCelsius } from "@/lib/weather/units";
import { hasPrecipitation } from "@/lib/weather/types";

describe("WMO code decoding", () => {
  it("maps the documented codes to the right visual", () => {
    expect(decodeWmo(0).kind).toBe("clear");
    expect(decodeWmo(3).kind).toBe("overcast");
    expect(decodeWmo(45).kind).toBe("fog");
    expect(decodeWmo(51).kind).toBe("drizzle");
    expect(decodeWmo(65).kind).toBe("rain");
    expect(decodeWmo(65).intensity).toBe("heavy");
    expect(decodeWmo(71).kind).toBe("snow");
    expect(decodeWmo(95).kind).toBe("thunderstorm");
  });

  it("treats freezing rain and drizzle as sleet", () => {
    expect(decodeWmo(56).kind).toBe("sleet");
    expect(decodeWmo(66).kind).toBe("sleet");
  });

  it("shows nothing rather than inventing weather for unknown codes", () => {
    // A provider adding a code we have never seen must not produce a blizzard.
    for (const bad of [999, -1, NaN, null, undefined, "61", {}]) {
      expect(decodeWmo(bad as unknown).kind).toBe("clear");
    }
  });

  it("keeps rain-shower codes distinct from steady rain intensity", () => {
    expect(decodeWmo(80).intensity).toBe("light");
    expect(decodeWmo(82).intensity).toBe("heavy");
  });
});

describe("cloud-cover refinement", () => {
  it("promotes a clear code to overcast under heavy cover", () => {
    expect(refineByCloudCover("clear", 90)).toBe("overcast");
    expect(refineByCloudCover("clear", 55)).toBe("cloudy");
    expect(refineByCloudCover("clear", 5)).toBe("clear");
  });

  it("never overrides actual precipitation", () => {
    expect(refineByCloudCover("rain", 10)).toBe("rain");
    expect(refineByCloudCover("snow", 100)).toBe("snow");
    expect(refineByCloudCover("thunderstorm", 0)).toBe("thunderstorm");
  });
});

describe("provider payload parsing", () => {
  // Shape recorded from a real Open-Meteo response.
  const payload = {
    current: {
      time: "2026-08-09T12:00",
      temperature_2m: 8.4,
      is_day: 1,
      weather_code: 61,
      cloud_cover: 100,
      wind_speed_10m: 18.7,
    },
  };

  it("reads a real response", () => {
    const snap = parseCurrent(payload);
    expect(snap).not.toBeNull();
    expect(snap!.kind).toBe("rain");
    expect(snap!.temperatureC).toBeCloseTo(8.4);
    expect(snap!.windKph).toBeCloseTo(18.7);
    expect(snap!.cloudCover).toBe(100);
    expect(snap!.isDay).toBe(true);
  });

  it("returns null for junk rather than throwing", () => {
    expect(parseCurrent(null)).toBeNull();
    expect(parseCurrent({})).toBeNull();
    expect(parseCurrent({ current: "no" })).toBeNull();
  });

  it("survives missing fields", () => {
    const snap = parseCurrent({ current: { weather_code: 0 } });
    expect(snap).not.toBeNull();
    expect(snap!.windKph).toBe(0);
    expect(snap!.cloudCover).toBe(0);
  });

  it("clamps a nonsensical cloud cover into range", () => {
    const snap = parseCurrent({ current: { weather_code: 61, cloud_cover: 480 } });
    expect(snap!.cloudCover).toBe(100);
  });
});

describe("coordinate coarsening (privacy)", () => {
  it("rounds to about a kilometre before anything is sent", () => {
    expect(coarsen(49.2827123)).toBe(49.28);
    expect(coarsen(-123.1207391)).toBe(-123.12);
  });

  it("never leaks more than two decimals", () => {
    for (const v of [51.500729, -0.124625, 35.6894, -46.6333]) {
      const s = String(coarsen(v));
      const decimals = s.includes(".") ? s.split(".")[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});

describe("sky tinting", () => {
  it("round-trips hex and rgb", () => {
    expect(rgbToHex(hexToRgb("#1F2E5E"))).toBe("#1f2e5e");
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("leaves clear weather completely untouched", () => {
    const base = ["#183768", "#2F5EA6", "#6E9CC9"] as const;
    // Normalised to lowercase, but the colour itself is unchanged.
    expect(tintSky(base, "clear", "midday")).toEqual([
      "#183768",
      "#2f5ea6",
      "#6e9cc9",
    ]);
  });

  it("darkens a midday sky under a thunderstorm", () => {
    const original = hexToRgb("#2F5EA6");
    const stormy = hexToRgb(tintColor("#2F5EA6", "thunderstorm", "midday"));
    const lum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    expect(lum(stormy)).toBeLessThan(lum(original));
  });

  it("softens the effect at night, where the sky is already dark", () => {
    const day = hexToRgb(tintColor("#2F5EA6", "rain", "midday"));
    const night = hexToRgb(tintColor("#2F5EA6", "rain", "night"));
    const lum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    // Night is not darkened further, so it stays brighter than the day tint.
    expect(lum(night)).toBeGreaterThan(lum(day));
  });

  it("always produces a valid six-digit hex", () => {
    const kinds = [
      "clear", "cloudy", "overcast", "fog", "drizzle",
      "rain", "sleet", "snow", "hail", "thunderstorm",
    ] as const;
    const phases = [
      "night", "predawn", "dawn", "morning",
      "midday", "afternoon", "dusk", "evening",
    ] as const;
    for (const k of kinds) {
      for (const p of phases) {
        expect(tintColor("#2F5EA6", k, p)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("star visibility", () => {
  it("shows every star on a clear night and none in rain or fog", () => {
    expect(starVisibility("clear", 0)).toBe(1);
    expect(starVisibility("rain", 100)).toBe(0);
    expect(starVisibility("fog", 100)).toBe(0);
    expect(starVisibility("snow", 80)).toBe(0);
  });

  it("scales with cover when partly cloudy", () => {
    expect(starVisibility("cloudy", 20)).toBeGreaterThan(
      starVisibility("cloudy", 80),
    );
  });

  it("stays within 0..1", () => {
    for (const cover of [0, 25, 50, 75, 100]) {
      const v = starVisibility("cloudy", cover);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("precipitation classification", () => {
  it("knows which kinds draw particles", () => {
    expect(hasPrecipitation("rain")).toBe(true);
    expect(hasPrecipitation("snow")).toBe(true);
    expect(hasPrecipitation("thunderstorm")).toBe(true);
    expect(hasPrecipitation("clear")).toBe(false);
    expect(hasPrecipitation("cloudy")).toBe(false);
    expect(hasPrecipitation("fog")).toBe(false);
  });
});

describe("temperature units", () => {
  it("gives Fahrenheit only to the places that use it", () => {
    expect(prefersCelsius("en-US")).toBe(false);
    expect(prefersCelsius("en-Latn-US")).toBe(false);
    expect(prefersCelsius("en-LR")).toBe(false);
  });

  it("gives Celsius to everyone else", () => {
    for (const tag of ["en-GB", "fa-IR", "ar-IQ", "en-CA", "de-DE", "ja-JP"]) {
      expect(prefersCelsius(tag)).toBe(true);
    }
  });

  it("defaults to Celsius when the locale is unreadable", () => {
    expect(prefersCelsius("")).toBe(true);
    expect(prefersCelsius("garbage")).toBe(true);
  });
});
