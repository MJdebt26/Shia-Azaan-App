"use client";

import {
  Callout,
  Card,
  Divider,
  Row,
  Segmented,
  Stepper,
  Toggle,
} from "@/components/ui/Controls";
import { IconInfo, IconWarn } from "@/components/ui/Icon";
import { hijriLabel } from "@/lib/time";
import type { ThemeMode, TimeFormat } from "@/lib/types";

interface GeneralCardProps {
  timeFormat: TimeFormat;
  onTimeFormat: (v: TimeFormat) => void;
  theme: ThemeMode;
  onTheme: (v: ThemeMode) => void;
  weather: boolean;
  onWeather: (v: boolean) => void;
  /** Surfaced so a failing weather fetch is visible, not silent. */
  weatherError: string | null;
  weatherLabel: string | null;
  hijriOffset: number;
  onHijriOffset: (v: number) => void;
  todayKey: string;
  canInstall: boolean;
  isIOS: boolean;
  installed: boolean;
  onInstall: () => void;
}

export function GeneralCard({
  timeFormat,
  onTimeFormat,
  theme,
  onTheme,
  weather,
  onWeather,
  weatherError,
  weatherLabel,
  hijriOffset,
  onHijriOffset,
  todayKey,
  canInstall,
  isIOS,
  installed,
  onInstall,
}: GeneralCardProps) {
  return (
    <Card label="General">
      <Row title="Time format">
        <Segmented
          label="Time format"
          value={timeFormat}
          options={[
            { value: "12h", label: "12h" },
            { value: "24h", label: "24h" },
          ]}
          onChange={onTimeFormat}
        />
      </Row>

      <Divider />

      <Row title="Appearance">
        <Segmented
          label="Appearance"
          value={theme}
          options={[
            { value: "system", label: "Auto" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={onTheme}
        />
      </Row>

      <Divider />

      <Row
        title="Live weather"
        hint={
          weather
            ? `The sky shows real conditions — rain, snow, cloud and fog.${
                weatherLabel ? ` Right now: ${weatherLabel.toLowerCase()}.` : ""
              } Your coordinates are rounded to about a kilometre before they are sent to Open-Meteo.`
            : "Off. The sky still changes with the sun, and nothing is sent off your device."
        }
      >
        <Toggle checked={weather} onChange={onWeather} label="Live weather" />
      </Row>

      {weather && weatherError && (
        <Callout tone="warn" icon={<IconWarn size={15} />}>
          {weatherError}
        </Callout>
      )}

      <Divider />

      <Row
        title="Hijri date offset"
        hint={`Currently showing ${hijriLabel(todayKey, hijriOffset) || "—"}. Communities begin the month on local sighting, so a day or two of difference is normal.`}
      >
        <Stepper
          label="Hijri offset"
          value={hijriOffset}
          min={-3}
          max={3}
          suffix={Math.abs(hijriOffset) === 1 ? "day" : "days"}
          onChange={onHijriOffset}
        />
      </Row>

      {!installed && (canInstall || isIOS) && (
        <>
          <Divider />
          <Row
            title="Install Awqāt"
            hint={
              canInstall
                ? "Adds it to your home screen and unlocks background alerts."
                : "Tap Share, then “Add to Home Screen”. On iPhone this is also what makes notifications work."
            }
          >
            {canInstall && (
              <button type="button" onClick={onInstall} className="btn btn-primary !min-h-0 !py-2 text-[12.5px]">
                Install
              </button>
            )}
          </Row>
        </>
      )}

      {installed && (
        <>
          <Divider />
          <Callout tone="good" icon={<IconInfo size={15} />}>
            Awqāt is installed. Prayer times work with no connection at all.
          </Callout>
        </>
      )}
    </Card>
  );
}
