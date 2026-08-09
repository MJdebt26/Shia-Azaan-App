"use client";

import { upcomingAlerts } from "@/lib/prayer/schedule";
import type { AlertJob } from "@/lib/prayer/schedule";
import type { AlertSettings, CalcSettings, Loc } from "@/lib/types";

/**
 * Foreground precision scheduler.
 *
 * Push handles delivery when the app is closed. This handles the case where the
 * app *is* open, where push would be both slower and less precise, and where we
 * also want to play the adhan through the page's audio element.
 *
 * Design notes, all of them learned the hard way:
 *
 *  - One `setTimeout` for the next instant, not a one-second interval. A ticking
 *    interval keeps the CPU (and on mobile, the radio) awake all day for an
 *    event that happens five times.
 *  - `setTimeout` silently fires *immediately* when the delay exceeds
 *    2^31 - 1 ms (~24.8 days), so every delay is clamped and re-armed.
 *  - Background tabs have their timers throttled to once a minute or frozen
 *    entirely, and a laptop that sleeps through Maghrib wakes with a timer that
 *    should have fired hours ago. So the timer is never trusted: on every wake
 *    the schedule is recomputed from `Date.now()`, and `visibilitychange`
 *    forces an immediate re-evaluation.
 *  - Clock jumps (manual change, NTP correction, crossing a timezone) are
 *    handled by the same rule — absolute instants are recomputed rather than
 *    counted down.
 */

/** setTimeout's maximum signed-32-bit delay; anything larger wraps to 0. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Longest a single timer is allowed to run before we re-derive the schedule.
 * Bounds the damage from a clock jump or a throttled timer to ten minutes
 * without turning this into a poller.
 */
const MAX_CHUNK_MS = 10 * 60_000;

/**
 * How late an alert may be and still fire. A prayer notification that arrives
 * two minutes late is useful; one that arrives forty minutes late — because the
 * laptop was asleep — is just confusing, so it is dropped as missed.
 */
const GRACE_MS = 120_000;

/** Fire slightly early rather than risk a wake that lands 40 ms short. */
const EARLY_TOLERANCE_MS = 1_000;

/** Forget fired jobs after two days; the dedupe key is per civil day. */
const MEMORY_MS = 48 * 3_600_000;

export interface AlertSchedulerOptions {
  /** Read fresh on every evaluation so settings changes take effect at once. */
  getLoc: () => Loc | null;
  getCalc: () => CalcSettings;
  getAlerts: () => AlertSettings;
  /** Invoked once per due alert. Exceptions are swallowed so one bad handler
   *  cannot stop the scheduler re-arming. */
  onFire: (job: AlertJob) => void;
  /** Called whenever the armed instant changes — handy for a debug readout. */
  onSchedule?: (next: AlertJob | null) => void;
}

export interface AlertScheduler {
  /** Begin scheduling. Idempotent. */
  start(): void;
  /** Stop and release listeners. Idempotent. */
  stop(): void;
  /** Recompute now — call after location, method or alert settings change. */
  refresh(): void;
  /** The instant currently armed for, or null when nothing is scheduled. */
  nextAt(): Date | null;
  /** The job currently armed for, or null. */
  nextJob(): AlertJob | null;
}

/**
 * Create a scheduler. It does nothing until `start()` is called, and it is safe
 * to construct during render (no side effects in the constructor).
 */
export function createAlertScheduler(
  options: AlertSchedulerOptions,
): AlertScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let armed: AlertJob | null = null;
  const fired = new Map<string, number>();

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const pruneMemory = (now: number): void => {
    for (const [key, at] of fired) {
      if (now - at > MEMORY_MS) fired.delete(key);
    }
  };

  /**
   * Recompute, fire anything due, and arm the next timer.
   * Everything funnels through here, which is why a clock jump is harmless.
   */
  const evaluate = (): void => {
    if (!running) return;
    clearTimer();

    const now = Date.now();
    pruneMemory(now);

    const loc = options.getLoc();
    if (!loc) {
      // No location yet (permission pending, first run). Re-check shortly
      // rather than going dormant.
      armed = null;
      options.onSchedule?.(null);
      timer = setTimeout(evaluate, MAX_CHUNK_MS);
      return;
    }

    const calc = options.getCalc();
    const alerts = options.getAlerts();

    // Start the window in the past so an alert that came due while the tab was
    // throttled is still found; `upcomingAlerts` is exclusive of `from`.
    const from = new Date(now - GRACE_MS);
    let jobs: AlertJob[];
    try {
      jobs = upcomingAlerts(loc, calc, alerts, from, 26);
    } catch {
      // A malformed location should not kill the scheduler for the session.
      armed = null;
      options.onSchedule?.(null);
      timer = setTimeout(evaluate, MAX_CHUNK_MS);
      return;
    }

    let next: AlertJob | null = null;
    for (const job of jobs) {
      if (fired.has(job.dedupeKey)) continue;
      const delta = job.fireAt.getTime() - now;

      if (delta <= EARLY_TOLERANCE_MS) {
        // Due, or overdue. Mark it consumed either way so a missed alert never
        // fires late on the next evaluation.
        fired.set(job.dedupeKey, now);
        if (delta >= -GRACE_MS) {
          try {
            options.onFire(job);
          } catch {
            /* a failing handler must not stop the chain */
          }
        }
        continue;
      }

      next = job;
      break;
    }

    armed = next;
    options.onSchedule?.(next);

    const delay = next
      ? next.fireAt.getTime() - Date.now()
      : Number.POSITIVE_INFINITY;
    // Clamp for the 24.8-day cap *and* for the drift ceiling, then re-arm.
    const wait = Math.max(0, Math.min(delay, MAX_CHUNK_MS, MAX_TIMEOUT_MS));
    timer = setTimeout(evaluate, wait);
  };

  const onVisibility = (): void => {
    // Resuming from a suspended tab: the armed timer may have been frozen or
    // may be about to fire late. Re-derive from the wall clock immediately.
    if (document.visibilityState === "visible") evaluate();
  };

  const onResume = (): void => evaluate();

  return {
    start(): void {
      if (running || typeof window === "undefined") return;
      running = true;
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onResume);
      window.addEventListener("pageshow", onResume);
      window.addEventListener("online", onResume);
      evaluate();
    },

    stop(): void {
      if (!running) return;
      running = false;
      clearTimer();
      armed = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("online", onResume);
    },

    refresh(): void {
      if (!running) return;
      evaluate();
    },

    nextAt(): Date | null {
      return armed ? armed.fireAt : null;
    },

    nextJob(): AlertJob | null {
      return armed;
    },
  };
}
