/**
 * Persistence primitive for everything the app remembers.
 *
 * Prayer times are useless if the app forgets your city, but `localStorage` is
 * one of the least reliable APIs on the web: it throws on *access* (not just on
 * write) in Safari private mode, in sandboxed iframes, when a corporate policy
 * blocks third-party storage, and it does not exist at all during server
 * rendering. Every one of those cases used to surface as a blank screen, so
 * this module is deliberately total: no function here can throw, and when the
 * real store is unavailable the values live in an in-memory Map for the
 * lifetime of the tab. The user still gets a working session; they just lose it
 * when they close the tab.
 *
 * Keys are expected to arrive already namespaced — see `STORAGE_KEYS` in
 * `lib/constants.ts`. This module stays key-transparent on purpose so the v1 →
 * v2 migration can also read the old un-namespaced keys.
 */

/** Prefix that every v2 key shares. Exposed for enumeration and cleanup. */
export const NAMESPACE = "awqat.";

/** Values written while the real store is unavailable, so reads stay coherent. */
const memory = new Map<string, string>();

/** `undefined` = not probed yet, `null` = probed and unusable. */
let probed: Storage | null | undefined;

/**
 * Resolve the backing store once, verifying with a real write.
 *
 * Feature-detecting with `"localStorage" in window` is not enough: Safari in
 * private mode exposes the object and then throws `QuotaExceededError` on the
 * first `setItem`, so the probe has to actually write something.
 */
function backing(): Storage | null {
  // Never cache the SSR answer: the same module instance is not reused in the
  // browser, but a bundler could theoretically evaluate this early.
  if (typeof window === "undefined") return null;
  if (probed !== undefined) return probed;

  try {
    const ls = window.localStorage;
    const probe = `${NAMESPACE}__probe__`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    probed = ls;
  } catch {
    probed = null;
  }
  return probed;
}

/** True when values written now will still be here after a reload. */
export function isPersistent(): boolean {
  return backing() !== null;
}

/** Raw string read. Returns null when the key is absent or unreadable. */
export function getRaw(key: string): string | null {
  const ls = backing();
  if (!ls) return memory.get(key) ?? null;
  try {
    return ls.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

/** Raw string write. Mirrors into memory so a failed write is still readable. */
export function setRaw(key: string, value: string): void {
  const ls = backing();
  if (!ls) {
    memory.set(key, value);
    return;
  }
  try {
    ls.setItem(key, value);
  } catch {
    // Quota exhausted or storage revoked mid-session: degrade, don't crash.
    memory.set(key, value);
  }
}

/** Delete a key from both the real store and the in-memory mirror. */
export function remove(key: string): void {
  memory.delete(key);
  const ls = backing();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    /* already gone as far as this session is concerned */
  }
}

/**
 * Parse a stored JSON value, falling back on anything unexpected.
 *
 * The fallback covers three separate failure modes with one branch: the key is
 * missing, the value is not valid JSON (a half-finished write, or another app
 * on the same origin), or the value is `null`/`undefined`. Callers still have
 * to *validate the shape* — see `lib/settings.ts` — because a syntactically
 * valid JSON blob from v1 is still the wrong type for v2.
 */
export function getJSON<T>(key: string, fallback: T): T {
  const raw = getRaw(key);
  if (raw == null || raw === "") return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** Serialise and store a value. Silently no-ops if it cannot be serialised. */
export function setJSON<T>(key: string, value: T): void {
  try {
    setRaw(key, JSON.stringify(value));
  } catch {
    /* circular structure — nothing sensible to persist */
  }
}

/** Every key currently held under `prefix`, for diagnostics and reset flows. */
export function keysWithPrefix(prefix: string = NAMESPACE): string[] {
  const found = new Set<string>();
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) found.add(key);
  }
  const ls = backing();
  if (ls) {
    try {
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key && key.startsWith(prefix)) found.add(key);
      }
    } catch {
      /* enumeration blocked — the memory keys are the best we can do */
    }
  }
  return [...found].sort();
}

/** Drop every value the app owns. Used by the "reset app" action. */
export function clearNamespace(prefix: string = NAMESPACE): void {
  for (const key of keysWithPrefix(prefix)) remove(key);
}

/** Grouped façade for callers that prefer a single import. */
export const store = {
  get: getRaw,
  set: setRaw,
  remove,
  getJSON,
  setJSON,
  keysWithPrefix,
  clearNamespace,
  isPersistent,
} as const;
