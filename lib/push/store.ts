import { createHash } from "node:crypto";
import type { PushRecord } from "@/lib/types";

/**
 * Persistence for push subscriptions.
 *
 * The cron dispatcher has to recompute prayer times for every subscribed device
 * without the device being awake, so the whole `PushRecord` (location, method,
 * alert settings, timezone) lives server-side.
 *
 * Two backends, chosen at runtime rather than at build time so the same code
 * runs on a laptop and on Vercel:
 *
 *  - **Upstash Redis REST** when UPSTASH_REDIS_REST_URL and
 *    UPSTASH_REDIS_REST_TOKEN are present. Plain `fetch` against the REST API —
 *    deliberately no SDK dependency, because the surface we need is four
 *    commands and an extra package is an extra thing to keep patched.
 *  - **In-memory Map** otherwise, which is correct only while a single process
 *    stays alive. It warns loudly, once, because a serverless cold start
 *    silently emptying the subscriber list is precisely the kind of invisible
 *    failure this rewrite exists to remove.
 *
 * SERVER ONLY (uses node:crypto).
 */

export interface PushStore {
  /** Look a record up by its push endpoint URL. */
  get(endpoint: string): Promise<PushRecord | null>;
  /** Insert or replace (subscribing twice from one device must not duplicate). */
  put(record: PushRecord): Promise<void>;
  /** Idempotent removal. */
  delete(endpoint: string): Promise<void>;
  /** Every stored record. Used once a minute by the dispatcher. */
  list(): Promise<PushRecord[]>;
  /** Human-readable backend name, surfaced in diagnostics. */
  readonly backend: "upstash" | "memory";
  /** False when records die with the process — the UI warns about this. */
  readonly durable: boolean;
}

const KEY_PREFIX = "awqat:push:v1:";

/**
 * Endpoints are long, contain provider-specific path segments and are not
 * guaranteed to be safe as a Redis key. A SHA-256 of the endpoint is stable,
 * fixed-width and collision-free for our purposes, and it keeps the raw
 * endpoint (a device identifier) out of key listings and logs.
 */
export function endpointKey(endpoint: string): string {
  return KEY_PREFIX + createHash("sha256").update(endpoint).digest("hex");
}

/** Narrowing parse: anything that is not a well-formed record is dropped. */
function parseRecord(raw: unknown): PushRecord | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<PushRecord>;
    const endpoint = candidate.subscription?.endpoint;
    if (typeof endpoint !== "string" || !endpoint) return null;
    if (!candidate.loc || !candidate.calc || !candidate.alerts) return null;
    return candidate as PushRecord;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upstash Redis over REST
// ---------------------------------------------------------------------------

interface UpstashResponse {
  result?: unknown;
  error?: string;
}

class UpstashStore implements PushStore {
  readonly backend = "upstash" as const;
  readonly durable = true;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      // Next caches `fetch` by default; a subscriber list must never be stale.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstash ${args[0]} failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as UpstashResponse;
    if (json.error) throw new Error(`Upstash ${args[0]} error: ${json.error}`);
    return json.result;
  }

  async get(endpoint: string): Promise<PushRecord | null> {
    return parseRecord(await this.command(["GET", endpointKey(endpoint)]));
  }

  async put(record: PushRecord): Promise<void> {
    await this.command([
      "SET",
      endpointKey(record.subscription.endpoint),
      JSON.stringify(record),
    ]);
  }

  async delete(endpoint: string): Promise<void> {
    await this.command(["DEL", endpointKey(endpoint)]);
  }

  async list(): Promise<PushRecord[]> {
    // SCAN rather than KEYS: KEYS blocks the Redis event loop for the whole
    // keyspace, and this runs every single minute.
    const keys: string[] = [];
    let cursor = "0";
    let guard = 0;
    do {
      const result = await this.command([
        "SCAN",
        cursor,
        "MATCH",
        `${KEY_PREFIX}*`,
        "COUNT",
        250,
      ]);
      if (!Array.isArray(result) || result.length < 2) break;
      cursor = String(result[0]);
      const page = result[1];
      if (Array.isArray(page)) {
        for (const k of page) if (typeof k === "string") keys.push(k);
      }
      guard += 1;
      // 250 000 subscribers is far past the point where this endpoint needs a
      // queue; stop rather than time the function out.
    } while (cursor !== "0" && guard < 1000);

    if (keys.length === 0) return [];

    const records: PushRecord[] = [];
    // MGET in batches: one round trip per 100 keys instead of per key.
    for (let i = 0; i < keys.length; i += 100) {
      const batch = keys.slice(i, i + 100);
      const values = await this.command(["MGET", ...batch]);
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const record = parseRecord(value);
        if (record) records.push(record);
      }
    }
    return records;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (development only)
// ---------------------------------------------------------------------------

/**
 * Held on `globalThis` so Next's dev-mode module reloading does not wipe the
 * subscriber list on every save.
 */
const MEMORY_SLOT = Symbol.for("awqat.push.memoryStore");

type GlobalWithStore = typeof globalThis & {
  [MEMORY_SLOT]?: Map<string, PushRecord>;
};

function memoryMap(): Map<string, PushRecord> {
  const g = globalThis as GlobalWithStore;
  if (!g[MEMORY_SLOT]) g[MEMORY_SLOT] = new Map<string, PushRecord>();
  return g[MEMORY_SLOT];
}

let warnedMemory = false;

class MemoryStore implements PushStore {
  readonly backend = "memory" as const;
  readonly durable = false;

  constructor() {
    if (!warnedMemory) {
      warnedMemory = true;
      console.warn(
        "[awqat/push] No UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — " +
          "push subscriptions are being kept in memory. They will be LOST on " +
          "every serverless cold start or server restart, so background " +
          "notifications will stop without any error. This is fine for local " +
          "development only; configure Upstash (or another Redis) before deploying.",
      );
    }
  }

  async get(endpoint: string): Promise<PushRecord | null> {
    return memoryMap().get(endpointKey(endpoint)) ?? null;
  }

  async put(record: PushRecord): Promise<void> {
    memoryMap().set(endpointKey(record.subscription.endpoint), record);
  }

  async delete(endpoint: string): Promise<void> {
    memoryMap().delete(endpointKey(endpoint));
  }

  async list(): Promise<PushRecord[]> {
    return [...memoryMap().values()];
  }
}

let store: PushStore | null = null;

/**
 * The process-wide store. Resolved lazily so the environment is read at request
 * time (Vercel injects env vars after module evaluation in some runtimes).
 */
export function getPushStore(): PushStore {
  if (store) return store;
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  store = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return store;
}

/** True when subscriptions survive a cold start. Shown in the diagnostics panel. */
export function isDurableStore(): boolean {
  return getPushStore().durable;
}

/** Test seam: forget the resolved backend so env changes take effect. */
export function resetPushStore(): void {
  store = null;
  warnedMemory = false;
}
