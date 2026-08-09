"use client";

import { PRAYERS } from "@/lib/constants";
import { PRAYER_ICONS } from "@/components/ui/Icon";
import { formatDuration, formatTime } from "@/lib/time";
import type { AlertSettings, PrayerKey, TimeFormat, Times } from "@/lib/types";
import { IconBell, IconBellOff } from "@/components/ui/Icon";

interface PrayerTableProps {
  times: Times;
  nowHours: number;
  currentKey: PrayerKey | null;
  nextKey: PrayerKey | null;
  timeFormat: TimeFormat;
  alerts: AlertSettings;
  alertsEnabled: boolean;
}

/**
 * The timetable.
 *
 * Rendered as a description list rather than a table: each row is a term (the
 * prayer) and its definition (the time), which is what a screen reader should
 * announce. The "now" row is marked with aria-current.
 */
export function PrayerTable({
  times,
  nowHours,
  currentKey,
  nextKey,
  timeFormat,
  alerts,
  alertsEnabled,
}: PrayerTableProps) {
  return (
    <section className="card overflow-hidden" aria-label="Today's prayer times">
      <ul className="divide-y divide-line">
        {PRAYERS.map((p) => {
          const Icon = PRAYER_ICONS[p.key];
          const t = formatTime(times[p.key], timeFormat);
          const isCurrent = p.key === currentKey;
          const isNext = p.key === nextKey;
          const alert = p.key === "sunrise" ? null : alerts[p.key as keyof AlertSettings];
          const silenced = !alertsEnabled || !alert || alert.mode === "off";
          const minsAway = (times[p.key] - nowHours) * 60;

          return (
            <li
              key={p.key}
              aria-current={isCurrent ? "true" : undefined}
              className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${
                isCurrent ? "bg-positive/[0.09]" : ""
              }`}
            >
              {isCurrent && (
                <span
                  className="absolute inset-y-0 left-0 w-[3px] bg-positive"
                  aria-hidden="true"
                />
              )}

              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  isCurrent
                    ? "bg-positive/15 text-positive"
                    : isNext
                      ? "bg-accent/15 text-accent"
                      : "text-faint"
                }`}
              >
                <Icon size={19} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[15px] font-semibold">{p.en}</span>
                  <span
                    className={`font-arabic text-[17px] leading-none ${
                      isCurrent ? "text-positive" : "text-accent"
                    }`}
                  >
                    {p.ar}
                  </span>
                  {isCurrent && (
                    <span className="rounded-md bg-positive/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-positive">
                      now
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-faint">
                  {p.note
                    ? p.note
                    : isNext && minsAway > 0
                      ? `in ${formatDuration(minsAway)}`
                      : p.translit}
                </p>
              </div>

              {p.key !== "sunrise" && (
                <span
                  className={silenced ? "text-faint/50" : "text-muted"}
                  title={
                    silenced
                      ? `${p.en} alert is off`
                      : `${p.en} alert is on`
                  }
                >
                  {silenced ? <IconBellOff size={15} /> : <IconBell size={15} />}
                  <span className="sr-only">
                    {silenced ? "Alert off" : "Alert on"}
                  </span>
                </span>
              )}

              <span className="tnum flex-shrink-0 text-right text-[16px] font-semibold">
                {t.time}
                {t.suffix && (
                  <span className="ml-0.5 text-[11px] font-semibold text-muted">
                    {t.suffix}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Imsāk / sunset / Islamic midnight — context, not prayers. */
export function MarkerStrip({
  times,
  timeFormat,
}: {
  times: Times;
  timeFormat: TimeFormat;
}) {
  const items = [
    { key: "imsak", label: "Imsāk", hint: "Fast begins" },
    { key: "sunset", label: "Sunset", hint: "Ghurūb" },
    { key: "midnight", label: "Midnight", hint: "Nisf al-layl" },
  ] as const;

  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((it) => {
        const t = formatTime(times[it.key], timeFormat);
        return (
          <div key={it.key} className="card px-3 py-2.5 text-center">
            <dt className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint">
              {it.label}
            </dt>
            <dd className="tnum mt-1 text-[14.5px] font-semibold">
              {t.time}
              {t.suffix && (
                <span className="ml-0.5 text-[10px] text-muted">{t.suffix}</span>
              )}
            </dd>
            <dd className="mt-0.5 text-[9.5px] text-faint">{it.hint}</dd>
          </div>
        );
      })}
    </dl>
  );
}
