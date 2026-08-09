"use client";

import type { WeatherKind, WeatherSnapshot } from "@/lib/weather/types";

/**
 * The small conditions readout in the corner of the hero.
 *
 * Text as well as an icon, on purpose: the animated layer behind it is
 * `aria-hidden`, so without this a screen-reader user would have no idea the
 * app is telling them it is raining.
 */

function Icon({ kind, size = 15 }: { kind: WeatherKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  const cloud = <path d="M6.5 18h11a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.3A3.4 3.4 0 0 0 6.5 18Z" />;

  switch (kind) {
    case "clear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.6" />
          {cloud}
        </svg>
      );
    case "overcast":
      return <svg {...common}>{cloud}</svg>;
    case "fog":
      return (
        <svg {...common}>
          <path d="M4 9h16M6 13h12M4 17h16" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          {cloud}
          <path d="M9 21v.01M12 22v.01M15 21v.01" />
        </svg>
      );
    case "thunderstorm":
      return (
        <svg {...common}>
          {cloud}
          <path d="M13 20.5 10 22l1.2-2.6L9.4 19l3-2.5-.7 2.3 1.9-.3-.6 2Z" />
        </svg>
      );
    default:
      // rain, drizzle, sleet, hail
      return (
        <svg {...common}>
          {cloud}
          <path d="M9 20.5 8 22.5M12.5 20.5l-1 2M16 20.5l-1 2" />
        </svg>
      );
  }
}

export function WeatherBadge({
  weather,
  useCelsius,
}: {
  weather: WeatherSnapshot | null;
  useCelsius: boolean;
}) {
  if (!weather) return null;

  const hasTemp = Number.isFinite(weather.temperatureC);
  const degrees = useCelsius
    ? weather.temperatureC
    : weather.temperatureC * 9 / 5 + 32;
  const unit = useCelsius ? "°C" : "°F";

  return (
    <p
      className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-black/22 px-2.5 py-1 text-[11.5px] font-semibold text-ink backdrop-blur-sm"
      title={`${weather.label}${hasTemp ? ` · ${Math.round(degrees)}${unit}` : ""}`}
    >
      <Icon kind={weather.kind} />
      {hasTemp && (
        <span className="tnum">
          {Math.round(degrees)}
          {unit}
        </span>
      )}
      <span className="sr-only">
        Current weather: {weather.label}
        {hasTemp ? `, ${Math.round(degrees)} degrees ${useCelsius ? "Celsius" : "Fahrenheit"}` : ""}
      </span>
    </p>
  );
}
