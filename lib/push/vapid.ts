import webpush from "web-push";

/**
 * VAPID configuration for Web Push.
 *
 * Why this exists as its own module: the private key must never reach the
 * browser bundle, and `web-push` must be configured exactly once per process.
 * Every server route imports the client from here instead of calling
 * `setVapidDetails` itself, so there is a single place where the secret is
 * read and a single place that decides whether push is usable at all.
 *
 * SERVER ONLY. Do not import this from a component — it pulls in `web-push`
 * (Node crypto) and reads the private key.
 */

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  /** `mailto:` or `https:` contact, sent to the push service in the JWT. */
  subject: string;
}

/**
 * Fallback contact used when VAPID_SUBJECT is unset. Push services only use it
 * to reach the operator about abuse, but they *do* reject malformed values, so
 * a syntactically valid default is safer than an empty string.
 */
const DEFAULT_SUBJECT = "mailto:awqat@localhost";

let cached: VapidConfig | null | undefined;
let configured = false;
let warnedMissing = false;

function readSubject(): string {
  const raw = (process.env.VAPID_SUBJECT ?? "").trim();
  if (!raw) return DEFAULT_SUBJECT;
  if (raw.startsWith("mailto:") || raw.startsWith("https://")) return raw;
  // A bare email address is the most common mistake; repair it rather than
  // failing the whole push system over a missing scheme.
  if (raw.includes("@") && !raw.includes(" ")) return `mailto:${raw}`;
  return DEFAULT_SUBJECT;
}

/**
 * Resolve the key pair from the environment.
 *
 * The public key is also accepted from NEXT_PUBLIC_VAPID_PUBLIC_KEY so a single
 * variable can serve both the server and the (inlined) client bundle; the
 * private key is only ever read from the non-public name.
 */
function readConfig(): VapidConfig | null {
  if (cached !== undefined) return cached;

  const publicKey = (
    process.env.VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    ""
  ).trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();

  if (!publicKey || !privateKey) {
    cached = null;
    return cached;
  }
  cached = { publicKey, privateKey, subject: readSubject() };
  return cached;
}

/**
 * True when the server can actually sign and send push messages.
 *
 * Routes call this before doing any work so the app can tell the user "push is
 * not configured on this deployment" instead of failing silently — the exact
 * class of bug this rewrite exists to eliminate.
 */
export function isPushConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * The public application server key, safe to hand to the browser.
 * Returns null when push is not configured.
 */
export function getVapidPublicKey(): string | null {
  return readConfig()?.publicKey ?? null;
}

/**
 * A `web-push` client with VAPID details already applied.
 *
 * Returns null (never throws) when the keys are absent, because a missing
 * configuration is an operational state the caller must report, not a crash.
 */
export function getWebPush(): typeof webpush | null {
  const config = readConfig();
  if (!config) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(
        "[awqat/push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — " +
          "background push is disabled. Run `npm run vapid` to generate a pair.",
      );
    }
    return null;
  }
  if (!configured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }
  return webpush;
}

/**
 * Test seam: drops the memoised config so a process that mutates
 * `process.env` (scripts, tests) picks up the new values.
 */
export function resetVapidCache(): void {
  cached = undefined;
  configured = false;
  warnedMissing = false;
}
