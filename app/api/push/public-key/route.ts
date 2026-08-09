import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/vapid";

/**
 * GET /api/push/public-key — hand the browser the VAPID application server key.
 *
 * Served at runtime rather than inlined at build time so the same build can be
 * deployed to environments with different keys, and so a deployment with *no*
 * keys answers 503 instead of handing out an empty string that would make
 * `pushManager.subscribe()` fail with an unreadable DOMException.
 *
 * `web-push` needs Node crypto, so this cannot run on the edge runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Push is not configured on this deployment (VAPID keys are missing).",
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { key },
    // The key is public and stable, but a rotation must not be masked by a CDN.
    { headers: { "cache-control": "public, max-age=0, must-revalidate" } },
  );
}
