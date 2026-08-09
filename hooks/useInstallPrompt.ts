"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Add-to-Home-Screen support.
 *
 * Installing matters more here than for most PWAs: an installed app gets a
 * launcher icon, runs standalone, and — on iOS — is the *only* context where
 * web push notifications work at all. So the UI needs to know three different
 * things, and this hook keeps them apart:
 *
 *  - Chromium fires `beforeinstallprompt`, which can be saved and replayed
 *    later from a button (`canInstall` / `promptInstall`).
 *  - iOS Safari fires nothing and exposes no API, so the only option is to
 *    show the "Share → Add to Home Screen" instructions (`isIOS`).
 *  - Either way, once the app is already running standalone there is nothing
 *    to offer (`isStandalone`).
 */

/** Not in lib.dom yet — Chromium-only. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export interface UseInstallPrompt {
  /** True when a native install prompt is ready to show. */
  canInstall: boolean;
  /** True when the app is already running as an installed app. */
  isStandalone: boolean;
  /** True on iPhone/iPad, where installing is a manual Share-sheet step. */
  isIOS: boolean;
  /** True once `appinstalled` has fired in this session. */
  justInstalled: boolean;
  promptInstall: () => Promise<InstallOutcome>;
}

const STANDALONE_QUERY = "(display-mode: standalone)";

/** iPadOS 13+ reports itself as a Mac, so touch support is the giveaway. */
function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.(STANDALONE_QUERY).matches) return true;
  // Safari's own non-standard flag, the only signal iOS gives us.
  return (
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt(): UseInstallPrompt {
  // Lazy initialisers, guarded for SSR: during server rendering these are
  // false, which is the correct "nothing to offer yet" state, and they resolve
  // on the client without a set-state-in-effect round trip.
  const [isIOS] = useState(detectIOS);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event): void => {
      // Suppress Chrome's own mini-infobar; the app offers install in context.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onInstalled = (): void => {
      setJustInstalled(true);
      setIsStandalone(true);
      setDeferred(null);
    };

    // The display mode flips the moment the app is launched from the home
    // screen in the same tab, so watch it rather than sampling once.
    const media = window.matchMedia?.(STANDALONE_QUERY);
    const onDisplayModeChange = (event: MediaQueryListEvent): void => {
      setIsStandalone(event.matches);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // The event is single-use whatever the answer; a dismissed prompt can
      // only be re-offered when the browser fires a fresh one.
      setDeferred(null);
      return outcome;
    } catch {
      setDeferred(null);
      return "unavailable";
    }
  }, [deferred]);

  return {
    canInstall: deferred !== null && !isStandalone,
    isStandalone,
    isIOS,
    justInstalled,
    promptInstall,
  };
}
