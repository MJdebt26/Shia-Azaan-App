"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface OrientationEventExt extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type PermFn = () => Promise<"granted" | "denied">;
interface DOE {
  requestPermission?: PermFn;
}

/**
 * Live compass heading (degrees, 0 = North) from device orientation.
 * On iOS, orientation needs an explicit permission tap → `enable()`.
 */
export function useDeviceOrientation() {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const attached = useRef(false);

  const onOrient = useCallback((e: OrientationEventExt) => {
    let h: number | null = null;
    if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
    if (h != null) setHeading(h);
  }, []);

  const attach = useCallback(() => {
    if (attached.current) return;
    attached.current = true;
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener, true);
    window.addEventListener("deviceorientation", onOrient as EventListener, true);
  }, [onOrient]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
      return;
    }
    const doe = DeviceOrientationEvent as unknown as DOE;
    if (typeof doe.requestPermission === "function") {
      setNeedsPermission(true); // iOS: wait for a user gesture
    } else {
      attach();
    }
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener, true);
      window.removeEventListener("deviceorientation", onOrient as EventListener, true);
    };
  }, [attach, onOrient]);

  const enable = useCallback(async () => {
    const doe = DeviceOrientationEvent as unknown as DOE;
    if (typeof doe.requestPermission !== "function") return;
    try {
      const res = await doe.requestPermission();
      if (res === "granted") {
        setNeedsPermission(false);
        attach();
      }
    } catch {
      /* user dismissed */
    }
  }, [attach]);

  return { heading, needsPermission, enable };
}
