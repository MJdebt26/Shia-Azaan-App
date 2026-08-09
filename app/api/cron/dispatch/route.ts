import { NextResponse } from "next/server";
import { WebPushError } from "web-push";
import { upcomingAlerts } from "@/lib/prayer/schedule";
import type { AlertJob } from "@/lib/prayer/schedule";
import { buildAlertPayload, serializePayload, topicFor } from "@/lib/push/payload";
import { getPushStore } from "@/lib/push/store";
import { getWebPush, isPushConfigured } from "@/lib/push/vapid";
import type { PushRecord } from "@/lib/types";

/**
 * GET /api/cron/dispatch — the heart of background delivery.
 *
 * Runs once a minute (see `vercel.json`). For every stored subscription it
 * recomputes that device's prayer times server-side and sends a push for
 * anything that came due since the last run.
 *
 * This replaces v1's use of the Notification Triggers API (`TimestampTrigger`),
 * which Google never shipped — the origin trial ended at Chrome 88 and the
 * feature was abandoned, so v1's "scheduled" notifications never fired at all.
 *
 * Two properties matter more than throughput here:
 *  - **Never miss.** Cron fires on a best-effort schedule, so the window looks
 *    ~90 seconds into the past. Jitter of up to half a minute is absorbed.
 *  - **Never repeat.** The look-back overlaps consecutive runs by design, so
 *    `record.lastSentKey` is compared against the job's `dedupeKey` before
 *    anything is sent.
 *
 * `web-push` needs Node crypto, so this cannot run on the edge runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Sending to a large subscriber list can outlast the default 10s budget. */
export const maxDuration = 60;

/** How far back to look. Longer than the cron period, on purpose. */
const LOOKBACK_MS = 90_000;

/** Concurrent sends. Push services are fine with this and it keeps us in budget. */
const CONCURRENCY = 8;

/**
 * Time-to-live for the push message itself. A prayer alert that surfaces two
 * hours late, when the phone finally reconnects, is worse than one that never
 * arrives — so let the push service drop it instead.
 */
const TTL_SECONDS = 300;

interface DispatchSummary {
  checked: number;
  sent: number;
  pruned: number;
  failed: number;
  /** Milliseconds spent, useful when tuning the cron budget. */
  ms: number;
  warning?: string;
}

/**
 * Vercel Cron adds `Authorization: Bearer $CRON_SECRET` automatically once the
 * variable exists on the project, so enforcement is conditional on it being
 * set. Without it the endpoint is only a rate-limited replay of work that is
 * already de-duplicated, but it should still be locked down in production.
 */
function authorize(request: Request): { ok: boolean; warning?: string } {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return {
      ok: true,
      warning:
        "CRON_SECRET is not set — this dispatch endpoint is unauthenticated.",
    };
  }
  const header = request.headers.get("authorization") ?? "";
  return { ok: header === `Bearer ${secret}` };
}

/** The alert, if any, that came due for this record in the current window. */
function dueJob(record: PushRecord, now: Date): AlertJob | null {
  const from = new Date(now.getTime() - LOOKBACK_MS);
  // `upcomingAlerts` is exclusive of `from` and inclusive of the horizon end,
  // so this window is exactly (now - LOOKBACK, now].
  const horizonHours = LOOKBACK_MS / 3_600_000;
  const jobs = upcomingAlerts(
    record.loc,
    record.calc,
    record.alerts,
    from,
    horizonHours,
  );
  if (jobs.length === 0) return null;
  // If two prayers somehow land in the same 90 seconds, the later one wins:
  // it is the one the user is about to pray.
  return jobs[jobs.length - 1];
}

/** Deliver one record's due alert. Returns what happened, never throws. */
async function dispatchOne(
  record: PushRecord,
  now: Date,
): Promise<"sent" | "skipped" | "pruned" | "failed"> {
  const job = dueJob(record, now);
  if (!job) return "skipped";
  if (record.lastSentKey === job.dedupeKey) return "skipped";

  const push = getWebPush();
  if (!push) return "failed";
  const store = getPushStore();

  try {
    await push.sendNotification(
      record.subscription,
      serializePayload(buildAlertPayload(job, record)),
      {
        TTL: TTL_SECONDS,
        // Prayer times are the definition of time-critical; ask the push
        // service to wake the device rather than batch with other messages.
        urgency: "high",
        topic: topicFor(job),
      },
    );
  } catch (error) {
    // 404 Not Found / 410 Gone: the browser threw the subscription away
    // (app uninstalled, permission revoked, profile cleared). Keeping it means
    // burning a request on every device, every minute, forever.
    if (
      error instanceof WebPushError &&
      (error.statusCode === 404 || error.statusCode === 410)
    ) {
      await store.delete(record.subscription.endpoint).catch(() => undefined);
      return "pruned";
    }
    console.error(
      "[awqat/cron] push failed",
      error instanceof WebPushError ? error.statusCode : error,
    );
    return "failed";
  }

  // Watermark only after a successful send, so a transient 5xx is retried on
  // the next minute while the alert is still inside the look-back window.
  try {
    await store.put({
      ...record,
      lastSentKey: job.dedupeKey,
      updatedAt: Date.now(),
    });
  } catch (error) {
    // Worst case the same alert is sent again next minute; the shared
    // notification tag makes that a replacement rather than a second buzz.
    console.error("[awqat/cron] could not persist dedupe watermark", error);
  }
  return "sent";
}

/** Run `worker` over `items` with bounded parallelism. */
async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function GET(request: Request): Promise<NextResponse> {
  const started = Date.now();
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push is not configured (VAPID keys are missing)." },
      { status: 503 },
    );
  }

  let records: PushRecord[];
  try {
    records = await getPushStore().list();
  } catch (error) {
    console.error("[awqat/cron] could not read subscriptions", error);
    return NextResponse.json(
      { error: "Subscription store is unavailable." },
      { status: 500 },
    );
  }

  const now = new Date();
  const outcomes = await pool(records, CONCURRENCY, (record) =>
    // One bad subscriber must never abort the run for everyone else.
    dispatchOne(record, now).catch(() => "failed" as const),
  );

  const summary: DispatchSummary = {
    checked: records.length,
    sent: outcomes.filter((o) => o === "sent").length,
    pruned: outcomes.filter((o) => o === "pruned").length,
    failed: outcomes.filter((o) => o === "failed").length,
    ms: Date.now() - started,
  };
  if (auth.warning) summary.warning = auth.warning;

  return NextResponse.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}
