"use client";

/**
 * The honesty layer.
 *
 * v1 of this app scheduled prayer alerts with the Notification Triggers API
 * (`TimestampTrigger`). That API never shipped: its origin trial ended at
 * Chrome 88 and it was abandoned. Calls to it succeeded, notifications were
 * "scheduled", and nothing ever fired. Users had no way to know.
 *
 * So the rule now is: never claim a capability we have not verified. This
 * module probes the runtime and returns a structured report the settings UI
 * renders verbatim — including the awkward cases, above all iOS, where Web Push
 * only works once the PWA has been added to the Home Screen (iOS 16.4+).
 */

/** `Notification.permission`, plus the case where the API is absent entirely. */
export type NotificationPermissionState = NotificationPermission | "unsupported";

export interface NotificationCapabilities {
  /** HTTPS or localhost. Service workers and push require it. */
  secureContext: boolean;
  /** `window.Notification` exists. */
  notificationApi: boolean;
  permission: NotificationPermissionState;
  /** `navigator.serviceWorker` exists. */
  serviceWorker: boolean;
  /** `window.PushManager` exists — the gate for background delivery. */
  pushManager: boolean;
  /** Running as an installed app rather than a browser tab. */
  standalone: boolean;
  isIOS: boolean;
  /** Major.minor as a number (16.4), or null when it cannot be read. */
  iosVersion: number | null;
  /** True only when an alert can arrive with the app closed. */
  canBackgroundDeliver: boolean;
  /** Plain-language, actionable explanations for everything that is missing. */
  reasons: string[];
}

/** iOS gained Web Push in 16.4, and only for Home Screen web apps. */
export const IOS_WEB_PUSH_MIN_VERSION = 16.4;

/** True when the page is running inside an installed / standalone web app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  if (iosStandalone === true) return true;
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  } catch {
    return false;
  }
}

/**
 * iPhone/iPad detection, including iPadOS, which reports a desktop Safari user
 * agent and can only be told apart by its touch support.
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Mac/.test(ua) && navigator.maxTouchPoints > 1;
}

/** Parse "OS 16_4_1" / "Version/17.2" out of the user agent. */
export function readIOSVersion(): number | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const os = /OS (\d+)[._](\d+)/.exec(ua);
  if (os) return Number(`${os[1]}.${os[2]}`);
  // iPadOS desktop-mode UA carries only the Safari version, which tracks the
  // OS major closely enough to decide the 16.4 cut-off.
  const safari = /Version\/(\d+)\.(\d+)/.exec(ua);
  if (safari) return Number(`${safari[1]}.${safari[2]}`);
  return null;
}

/** Current permission without throwing on browsers that lack the API. */
function readPermission(hasApi: boolean): NotificationPermissionState {
  if (!hasApi) return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

/**
 * Probe the runtime and explain, in words a user can act on, what will and will
 * not work. Call this on mount and again after any permission prompt — nothing
 * here is cached, because permission and display-mode both change at runtime.
 */
export function detectCapabilities(): NotificationCapabilities {
  if (typeof window === "undefined") {
    // Server render: report nothing as available rather than guessing, so the
    // first paint never promises a capability the device may not have.
    return {
      secureContext: false,
      notificationApi: false,
      permission: "unsupported",
      serviceWorker: false,
      pushManager: false,
      standalone: false,
      isIOS: false,
      iosVersion: null,
      canBackgroundDeliver: false,
      reasons: [],
    };
  }

  const secureContext = window.isSecureContext === true;
  const notificationApi = "Notification" in window;
  const serviceWorker = "serviceWorker" in navigator;
  const pushManager = "PushManager" in window;
  const permission = readPermission(notificationApi);
  const standalone = isStandaloneDisplay();
  const isIOS = isIOSDevice();
  const iosVersion = isIOS ? readIOSVersion() : null;

  const reasons: string[] = [];

  if (!secureContext) {
    reasons.push(
      "This page is not running in a secure context. Notifications and push " +
        "need HTTPS (or localhost).",
    );
  }

  // The iOS story first: on iPhone and iPad it is the single reason people
  // think the app is broken, and the fix is two taps.
  if (isIOS && !standalone) {
    reasons.push(
      "On iPhone and iPad, notifications only work once Awqāt is added to the " +
        "Home Screen. Tap the Share button, choose \"Add to Home Screen\", " +
        "then open Awqāt from its new icon and enable alerts there. " +
        "(Requires iOS 16.4 or later.)",
    );
  }
  if (isIOS && iosVersion !== null && iosVersion < IOS_WEB_PUSH_MIN_VERSION) {
    reasons.push(
      `This device reports iOS ${iosVersion.toFixed(1)}. Web Push arrived in ` +
        "iOS 16.4 — update iOS to receive alerts while the app is closed.",
    );
  }

  if (!notificationApi) {
    reasons.push(
      "This browser does not expose the Notification API, so Awqāt cannot show " +
        "system notifications at all. Alerts will be limited to the on-screen " +
        "banner and sound while the app is open.",
    );
  } else if (permission === "default") {
    reasons.push(
      "Notification permission has not been granted yet. Enable alerts to be " +
        "asked for it.",
    );
  } else if (permission === "denied") {
    reasons.push(
      "Notifications are blocked for this site. Re-enable them in your " +
        "browser's site settings — a page cannot ask again once blocked.",
    );
  }

  if (!serviceWorker) {
    reasons.push(
      "Service workers are unavailable (private browsing blocks them in some " +
        "browsers), so offline support and background alerts are off.",
    );
  }
  if (!pushManager && !(isIOS && !standalone)) {
    reasons.push(
      "This browser has no Push API, so alerts can only fire while Awqāt is " +
        "open in a tab.",
    );
  }

  const canBackgroundDeliver =
    secureContext &&
    notificationApi &&
    serviceWorker &&
    pushManager &&
    permission === "granted" &&
    !(isIOS && !standalone) &&
    !(isIOS && iosVersion !== null && iosVersion < IOS_WEB_PUSH_MIN_VERSION);

  return {
    secureContext,
    notificationApi,
    permission,
    serviceWorker,
    pushManager,
    standalone,
    isIOS,
    iosVersion,
    canBackgroundDeliver,
    reasons,
  };
}

/**
 * One-line summary for the settings header, so the state is legible before the
 * user expands the detail list.
 */
export function summarizeCapabilities(caps: NotificationCapabilities): string {
  if (caps.canBackgroundDeliver) {
    return "Alerts will arrive even when Awqāt is closed.";
  }
  if (caps.notificationApi && caps.permission === "granted") {
    return "Alerts will only fire while Awqāt is open.";
  }
  if (caps.permission === "denied") return "Notifications are blocked.";
  return "Notifications are not set up yet.";
}
