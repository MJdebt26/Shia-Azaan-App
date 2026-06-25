import { PRAYERS } from "./constants";
import type { PrayerMeta, Times } from "./types";

/** Index of the prayer period we're currently in (-1 = before today's Fajr). */
export function currentPrayerIndex(nowH: number, times: Times): number {
  let idx = -1;
  for (let i = 0; i < PRAYERS.length; i++) {
    if (nowH >= times[PRAYERS[i].key]) idx = i;
  }
  if (nowH < times.fajr) idx = -1;
  return idx;
}

export interface NextPrayer {
  meta: PrayerMeta;
  /** Hour of the next prayer; may exceed 24 when it is tomorrow's Fajr. */
  hour: number;
}

export function nextPrayer(nowH: number, times: Times): NextPrayer {
  for (const p of PRAYERS) {
    if (times[p.key] > nowH) return { meta: p, hour: times[p.key] };
  }
  // After Isha → next is tomorrow's Fajr.
  return { meta: PRAYERS[0], hour: times.fajr + 24 };
}
