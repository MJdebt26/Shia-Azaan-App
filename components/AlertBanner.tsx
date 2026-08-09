"use client";

import { IconClose } from "./ui/Icon";

/**
 * The in-app prayer banner.
 *
 * Announced politely rather than assertively: it appears at a known time, so
 * interrupting whatever a screen reader is currently saying would be rude.
 */
export function AlertBanner({
  banner,
  onDismiss,
}: {
  banner: { title: string; body: string } | null;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-3 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-positive-deep bg-gradient-to-b from-[#16341f] to-[#0f2417] px-4 py-3 text-ink shadow-lg transition-all duration-300 ${
        banner
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-[160%] opacity-0"
      }`}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <span className="font-arabic flex-shrink-0 text-[22px] text-positive">
        الله أكبر
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">{banner?.title ?? ""}</p>
        <p className="truncate text-[11.5px] text-muted">{banner?.body ?? ""}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10"
      >
        <IconClose size={16} />
      </button>
    </div>
  );
}
