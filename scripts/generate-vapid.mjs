#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 * Run once per deployment (`npm run vapid`) and keep the output somewhere safe.
 * Rotating these keys invalidates every existing push subscription: devices
 * must call `pushManager.subscribe()` again with the new application server
 * key, which the app does automatically on next open, but until then they get
 * nothing. So generate once, then leave them alone.
 */

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

const contact = process.argv[2] ?? "mailto:you@example.com";

process.stdout.write(
  [
    "",
    "VAPID keys generated. Copy these into .env.local (local) and into your",
    "hosting provider's environment variables (production).",
    "",
    "The private key is a secret: never commit it, never expose it to the client.",
    "",
    "# ---------------------------------------------------------------------",
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    `VAPID_SUBJECT=${contact}`,
    "",
    "# Same public key, exposed to the browser bundle as a build-time fallback",
    "# for when /api/push/public-key cannot be reached.",
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
    "# ---------------------------------------------------------------------",
    "",
    "Pass a contact address to embed it directly:  npm run vapid -- mailto:me@site.com",
    "",
  ].join("\n"),
);
