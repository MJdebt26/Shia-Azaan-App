"use client";

import { useEffect, useState } from "react";

/**
 * A ticking clock.
 *
 * Two details make this different from the usual `setInterval(…, 1000)`:
 *
 *  1. **Aligned to the wall clock.** Each tick is scheduled for the next real
 *     second boundary, not "1000 ms from whenever the last one ran". A drifting
 *     interval makes the countdown skip or repeat a second every few minutes,
 *     which is very visible next to a large "04:59" display.
 *
 *  2. **Paused while the tab is hidden.** A backgrounded prayer-times tab left
 *     open all day would otherwise wake the main thread every second forever.
 *     Browsers throttle background timers, but throttled is not free — and a
 *     throttled tick also means the time is *stale* when the user comes back.
 *     So the tick stops on hide and re-syncs immediately on show, which is both
 *     cheaper and more correct.
 *
 * @param intervalMs how often to tick; 1000 for a seconds countdown, 60000 when
 *   only minutes are displayed.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Guard against a caller passing 0 and pinning the CPU.
    const period = Math.max(50, Math.floor(intervalMs) || 1000);
    let timer: number | undefined;
    let cancelled = false;

    const stop = (): void => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const schedule = (): void => {
      stop();
      if (cancelled || document.visibilityState === "hidden") return;
      // Fire on the next boundary — a few ms late is fine, early is not, so
      // the remainder is subtracted from a whole period rather than rounded.
      const delay = period - (Date.now() % period);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };

    const resync = (): void => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      setNow(new Date());
      schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", resync);
    // Restoring from the back/forward cache does not always fire
    // visibilitychange, and that restore can be hours later.
    window.addEventListener("pageshow", resync);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("pageshow", resync);
    };
  }, [intervalMs]);

  return now;
}
