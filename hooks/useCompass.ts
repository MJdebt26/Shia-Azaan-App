"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live compass heading for the Qibla view.
 *
 * Getting a *usable* heading out of the browser takes four separate fixes:
 *
 *  1. **iOS gating.** Safari only delivers orientation events after
 *     `DeviceOrientationEvent.requestPermission()` resolves, and that call is
 *     only honoured inside a user gesture — hence `enable()`, which the UI
 *     wires to a button rather than calling on mount.
 *  2. **True north.** Safari exposes `webkitCompassHeading` (already true
 *     north, magnetic declination applied). Everyone else needs the
 *     `deviceorientationabsolute` event, where the heading is `360 - alpha`.
 *     A *relative* `deviceorientation` event is deliberately ignored: its alpha
 *     is measured from wherever the device happened to be, so pointing a needle
 *     with it would be worse than showing nothing.
 *  3. **Screen rotation.** Both readings describe the top of the *device*, not
 *     the top of the *screen*. In landscape those differ by the screen
 *     orientation angle, and without compensating, the needle is 90° out.
 *  4. **Jitter.** Raw magnetometer readings wobble by several degrees at
 *     60 Hz. The samples are averaged as unit vectors (a circular mean, so
 *     359° and 1° average to 0° rather than 180°) and only re-rendered when the
 *     result actually moves.
 */

interface DeviceOrientationEventExt extends DeviceOrientationEvent {
  /** iOS only: heading in degrees clockwise from true north. */
  webkitCompassHeading?: number;
  /** iOS only: ± degrees of uncertainty, or -1 when unreliable. */
  webkitCompassAccuracy?: number;
}

type PermissionRequest = () => Promise<"granted" | "denied" | "default">;

interface DeviceOrientationEventCtor {
  requestPermission?: PermissionRequest;
}

export interface UseCompass {
  /** Degrees clockwise from true north for the top of the screen, or null. */
  heading: number | null;
  /** ± degrees of uncertainty when the device reports it. */
  accuracy: number | null;
  /** True on iOS before the user has granted motion access. */
  needsPermission: boolean;
  /** False when this browser has no orientation events at all. */
  supported: boolean;
  /** Ask for access and start listening. Must be called from a user gesture. */
  enable: () => Promise<void>;
  error: string | null;
}

/** ~0.4 s of history at 20 Hz: enough to settle, short enough to feel live. */
const SMOOTHING_SAMPLES = 8;
/** Below this the needle would only shimmer, so skip the re-render. */
const MIN_DELTA_DEG = 0.4;
/** Cap re-renders at ~30 fps even when the device streams faster. */
const MIN_EMIT_MS = 33;
/** If nothing arrives in this long, there is no magnetometer to wait for. */
const NO_READING_MS = 3000;

const DEG = Math.PI / 180;

function orientationEventCtor(): DeviceOrientationEventCtor | null {
  if (typeof window === "undefined") return null;
  if (typeof window.DeviceOrientationEvent === "undefined") return null;
  return window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtor;
}

/** How far the rendered page is rotated from the device's natural orientation. */
function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number") return angle;
  // iOS < 16.4 has no ScreenOrientation API; window.orientation uses the same
  // convention modulo 360 (-90 ≡ 270).
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

function normalise(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Mean of angles taken as unit vectors, so the 0°/360° seam is handled. */
function circularMean(samples: readonly number[]): number {
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    x += Math.cos(sample * DEG);
    y += Math.sin(sample * DEG);
  }
  if (x === 0 && y === 0) return samples[samples.length - 1] ?? 0;
  return normalise(Math.atan2(y, x) / DEG);
}

/** Smallest absolute difference between two bearings, in [0,180]. */
function angleDelta(a: number, b: number): number {
  const d = Math.abs(normalise(a) - normalise(b)) % 360;
  return d > 180 ? 360 - d : d;
}

export function useCompass(): UseCompass {
  const [supported] = useState(() => orientationEventCtor() !== null);
  // Lazy initialiser rather than an effect: it keeps the first client render
  // truthful without a set-state-in-effect round trip. During SSR there is no
  // window, so this is false and the button simply appears after hydration.
  const [needsPermission, setNeedsPermission] = useState(
    () => typeof orientationEventCtor()?.requestPermission === "function",
  );
  const [listening, setListening] = useState(
    () =>
      orientationEventCtor() !== null &&
      typeof orientationEventCtor()?.requestPermission !== "function",
  );
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const samples = useRef<number[]>([]);
  const lastEmit = useRef(0);
  const lastHeading = useRef<number | null>(null);

  useEffect(() => {
    if (!listening || typeof window === "undefined") return;

    let gotReading = false;

    const handle = (event: Event): void => {
      const e = event as DeviceOrientationEventExt;

      let raw: number | null = null;
      if (
        typeof e.webkitCompassHeading === "number" &&
        Number.isFinite(e.webkitCompassHeading) &&
        e.webkitCompassHeading >= 0
      ) {
        raw = e.webkitCompassHeading;
      } else if (e.absolute && typeof e.alpha === "number" && Number.isFinite(e.alpha)) {
        raw = 360 - e.alpha;
      }
      if (raw === null) return;

      if (!gotReading) {
        gotReading = true;
        setError(null);
      }

      const reported = e.webkitCompassAccuracy;
      if (typeof reported === "number") {
        setAccuracy(reported >= 0 ? reported : null);
      }

      const value = normalise(raw + screenAngle());
      const buffer = samples.current;
      buffer.push(value);
      if (buffer.length > SMOOTHING_SAMPLES) buffer.shift();

      const smoothed = circularMean(buffer);
      const now = Date.now();
      const previous = lastHeading.current;
      if (
        previous !== null &&
        (now - lastEmit.current < MIN_EMIT_MS ||
          angleDelta(previous, smoothed) < MIN_DELTA_DEG)
      ) {
        return;
      }
      lastEmit.current = now;
      lastHeading.current = smoothed;
      setHeading(smoothed);
    };

    // Absolute events are the ones worth having; the plain event is still
    // registered because iOS delivers webkitCompassHeading only through it.
    window.addEventListener("deviceorientationabsolute", handle, true);
    window.addEventListener("deviceorientation", handle, true);

    // Desktop browsers define DeviceOrientationEvent and then never fire it.
    const idle = window.setTimeout(() => {
      if (!gotReading) {
        setError(
          "No compass readings — this device probably has no magnetometer. The Qibla direction below is still correct; line it up with a real compass or a map.",
        );
      }
    }, NO_READING_MS);

    return () => {
      window.clearTimeout(idle);
      window.removeEventListener("deviceorientationabsolute", handle, true);
      window.removeEventListener("deviceorientation", handle, true);
      samples.current = [];
      lastHeading.current = null;
    };
  }, [listening]);

  const enable = useCallback(async () => {
    const ctor = orientationEventCtor();
    if (!ctor) {
      setError("This browser doesn't provide compass readings.");
      return;
    }
    if (typeof ctor.requestPermission !== "function") {
      setNeedsPermission(false);
      setListening(true);
      return;
    }
    try {
      const result = await ctor.requestPermission();
      if (result === "granted") {
        setNeedsPermission(false);
        setError(null);
        setListening(true);
      } else {
        setError(
          "Motion & orientation access was denied. Enable it in Settings › Apps › Safari › Motion & Orientation Access, then reload.",
        );
      }
    } catch {
      // Thrown when the call did not originate from a user gesture.
      setError("Compass access could not be requested. Try tapping the button again.");
    }
  }, []);

  return { heading, accuracy, needsPermission, supported, enable, error };
}
