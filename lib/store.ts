/**
 * localStorage wrapper that never throws — falls back to an in-memory map when
 * storage is unavailable (private mode, sandboxed iframe, SSR).
 */
const mem = new Map<string, string>();

export const store = {
  get(key: string): string | null {
    if (typeof window === "undefined") return mem.get(key) ?? null;
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? (mem.get(key) ?? null) : v;
    } catch {
      return mem.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    mem.set(key, value);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* in-memory fallback already set */
    }
  },
};
