import type { FormattedTime, Loc } from "./types";

/** UTC offset in hours for a place's IANA tz on a given date (DST-aware). */
export function tzOffset(tz: string | null, date: Date): number {
  if (!tz) return -date.getTimezoneOffset() / 60;
  try {
    const u = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const z = new Date(date.toLocaleString("en-US", { timeZone: tz }));
    return (z.getTime() - u.getTime()) / 3_600_000;
  } catch {
    return -date.getTimezoneOffset() / 60;
  }
}

/** A Date carrying the wall-clock Y/M/D/H/M/S of the location's timezone. */
export function localDateObj(loc: Loc | null, now: Date = new Date()): Date {
  if (!loc || !loc.tz) return now;
  try {
    return new Date(now.toLocaleString("en-US", { timeZone: loc.tz }));
  } catch {
    return now;
  }
}

/** Current wall-clock time in the location's tz as fractional hours [0,24). */
export function localNowHours(loc: Loc | null, now: Date = new Date()): number {
  const d = localDateObj(loc, now);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Stable key for the local calendar day (so times recompute at midnight). */
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function fmtTime(
  h: number | null | undefined,
  fmt24: boolean,
): FormattedTime {
  if (h == null || isNaN(h)) return { h: "—", ap: "" };
  h = ((h % 24) + 24) % 24;
  let hr = Math.floor(h);
  let mn = Math.round((h - hr) * 60);
  if (mn === 60) {
    mn = 0;
    hr = (hr + 1) % 24;
  }
  if (fmt24) {
    return {
      h: `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`,
      ap: "",
    };
  }
  const ap = hr < 12 ? "AM" : "PM";
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return { h: `${h12}:${String(mn).padStart(2, "0")}`, ap };
}

export function fmtSpan(mins: number): string {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function gregString(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function hijriString(d: Date): string {
  try {
    const h = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
    return h.replace(" AH", "") + " AH";
  } catch {
    try {
      return new Intl.DateTimeFormat("en-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return "";
    }
  }
}
