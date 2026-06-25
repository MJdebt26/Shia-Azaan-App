"use client";

import { useEffect, useState } from "react";

/** A Date that updates on a fixed interval (default every second). */
export function useClock(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
