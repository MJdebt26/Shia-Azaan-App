/**
 * Prints the environment variables to paste into Vercel.
 *
 * Reads .env.local (which is gitignored and never leaves your machine) and
 * formats it for Vercel's "Import .env" box, which accepts KEY=value lines
 * pasted in bulk — far less error-prone than typing five secrets by hand.
 */
import { readFileSync } from "node:fs";

const NEEDED = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "CRON_SECRET",
];

let raw;
try {
  raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
} catch {
  console.error("No .env.local found. Run:  npm run vapid -- mailto:you@example.com");
  process.exit(1);
}

const found = new Map();
for (const line of raw.split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) found.set(m[1], m[2]);
}

const missing = NEEDED.filter((k) => !found.get(k));
if (missing.length) {
  console.error(`Missing from .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("# Paste all of this into Vercel → Settings → Environment Variables");
console.log("# (use the 'Import .env' / bulk-paste box, select all environments)\n");
for (const k of NEEDED) console.log(`${k}=${found.get(k)}`);
console.log("\n# Optional but strongly recommended for production — without a");
console.log("# Redis, push subscriptions are lost on every cold start:");
console.log("# UPSTASH_REDIS_REST_URL=");
console.log("# UPSTASH_REDIS_REST_TOKEN=");
