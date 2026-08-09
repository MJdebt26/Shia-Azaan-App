"use client";

import { Hero } from "./Hero";
import { MarkerStrip, PrayerTable } from "./PrayerTable";
import { Callout } from "@/components/ui/Controls";
import { IconWarn } from "@/components/ui/Icon";
import type { SkyPhase } from "@/lib/sky";
import type { WeatherSnapshot } from "@/lib/weather/types";
import type {
  AlertSettings,
  PrayerKey,
  TimeFormat,
  Times,
} from "@/lib/types";

interface TodayViewProps {
  phase: SkyPhase;
  times: Times;
  nowHours: number;
  currentKey: PrayerKey | null;
  nextKey: PrayerKey;
  nextAt: Date;
  nextHours: number;
  minutesUntil: number;
  progress: number;
  isFirstOfDay: boolean;
  timeFormat: TimeFormat;
  alerts: AlertSettings;
  alertsEnabled: boolean;
  lat: number;
  lng: number;
  tzOffset: number;
  dayKey: string;
  /** Shown when the location's latitude makes the times approximate. */
  polarWarning: string | null;
  weather: WeatherSnapshot | null;
  useCelsius: boolean;
}

export function TodayView(props: TodayViewProps) {
  const {
    phase, times, nowHours, currentKey, nextKey, nextAt, nextHours,
    minutesUntil, progress, isFirstOfDay, timeFormat, alerts, alertsEnabled,
    lat, lng, tzOffset, dayKey, polarWarning, weather, useCelsius,
  } = props;

  return (
    <div className="space-y-3.5">
      <Hero
        phase={phase}
        nextKey={nextKey}
        nextAt={nextAt}
        nextHours={nextHours}
        minutesUntil={minutesUntil}
        progress={progress}
        isFirstOfDay={isFirstOfDay}
        timeFormat={timeFormat}
        lat={lat}
        lng={lng}
        tzOffset={tzOffset}
        dayKey={dayKey}
        times={times}
        nowHours={nowHours}
        currentKey={currentKey}
        weather={weather}
        useCelsius={useCelsius}
      />

      {polarWarning && (
        <Callout tone="warn" icon={<IconWarn size={15} />}>
          {polarWarning}
        </Callout>
      )}

      <PrayerTable
        times={times}
        nowHours={nowHours}
        currentKey={currentKey}
        nextKey={nextKey}
        timeFormat={timeFormat}
        alerts={alerts}
        alertsEnabled={alertsEnabled}
      />

      <MarkerStrip times={times} timeFormat={timeFormat} />
    </div>
  );
}
