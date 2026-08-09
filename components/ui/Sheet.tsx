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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    // Focus the first control once the entry transition has settled.
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel)?.focus();
    }, 220);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      window.clearTimeout(id);
      restoreTo.current?.focus?.();
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
