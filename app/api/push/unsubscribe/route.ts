import { NextResponse } from "next/server";
import { getPushStore } from "@/lib/push/store";

/**
 * POST /api/push/unsubscribe — forget a device.
 *
 * Deliberately idempotent and deliberately unauthenticated in the same way the
 * subscribe route is: the endpoint URL is itself the capability. Someone who
 * already holds another device's endpoint can only stop its notifications, and
 * that device re-subscribes the next time the app opens. Requiring an account
 * to turn notifications *off* would be worse.
 *
 * `node:crypto` (key hashing) needs the Node runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let endpoint: unknown;
  try {
    const text = await request.text();
    if (text.length > 8_000) {
      return NextResponse.json(
        { ok: false, error: "Request body is too large." },
        { status: 413 },
      );
    }
    const body: unknown = JSON.parse(text);
    endpoint =
      typeof body === "object" && body !== null
        ? (body as { endpoint?: unknown }).endpoint
        : undefined;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (typeof endpoint !== "string" || !endpoint || endpoint.length > 2048) {
    return NextResponse.json(
      { ok: false, error: "endpoint must be a URL string." },
      { status: 400 },
    );
  }

  try {
    // No existence check: deleting an endpoint that was never stored is a
    // success from the caller's point of view.
    await getPushStore().delete(endpoint);
  } catch (error) {
    console.error("[awqat/push] failed to delete subscription", error);
    return NextResponse.json(
      { ok: false, error: "Could not remove the subscription. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
