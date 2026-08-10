"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { IconClose } from "./Icon";

/**
 * An accessible bottom sheet.
 *
 * Does the things a `<div>` with a transform cannot: traps focus, restores it
 * on close, locks background scroll, closes on Escape, and hides the rest of
 * the page from assistive technology while open.
 */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Rendered under the title, above the scrolling body. */
  sticky?: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Body-scroll lock, reference-counted at module scope.
 *
 * Two sheets are mounted at once (the location picker and the adhan picker) and
 * both reach for the same `document.body.style.overflow`. With each one saving
 * and restoring its own idea of the original value, an unlucky interleaving
 * leaves the body stuck at `overflow: hidden` and the whole page unscrollable
 * with no sheet on screen to explain it. A counter makes the lock idempotent:
 * the first caller saves and locks, the last one restores.
 */
let lockCount = 0;
let savedOverflow = "";

function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = savedOverflow;
  };
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  sticky,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  /**
   * Callers pass `onClose` as an inline arrow, so it is a new function on every
   * render — and the app re-renders every second to tick the countdown. Reading
   * it through a ref keeps the effect below dependent on `open` alone.
   *
   * That matters more than it looks: when the effect re-ran every second, its
   * cleanup called `restoreTo.current.focus()` each time, which pulled focus out
   * of the city search box a second after you tapped it and closed the keyboard.
   * Typing a location was impossible on a phone for exactly this reason.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const releaseScroll = lockBodyScroll();
    document.addEventListener("keydown", handleKeyDown);

    // Move focus into the sheet once the entry transition has settled, but to
    // the panel itself rather than to its first control — and never if the user
    // has already put focus somewhere inside, which on a phone means they have
    // tapped the search box and are waiting for the keyboard.
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(document.activeElement)) return;
      panel.focus();
    }, 220);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      releaseScroll();
      window.clearTimeout(id);
      // Only meaningful on a real close, which is the only time this runs now.
      const previous = restoreTo.current;
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open, handleKeyDown]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-bg-deep/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        // `inert` keeps a closed sheet out of the tab order and the a11y tree.
        // React 19 supports it as a real boolean prop.
        inert={!open}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86dvh] w-full max-w-app flex-col rounded-t-3xl border border-b-0 border-line-strong bg-bg-deep shadow-lg transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <div className="flex-shrink-0 px-5 pt-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-xs text-faint">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn btn-quiet -mr-1 !min-h-0 !p-2"
            >
              <IconClose size={18} />
            </button>
          </div>
          {sticky && <div className="mt-4">{sticky}</div>}
        </div>

        <div
          className="mt-3 flex-1 overflow-y-auto overscroll-contain px-5"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
