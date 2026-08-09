"use client";

import type { ReactNode } from "react";

/** Small, shared form controls. All of them are real buttons/inputs. */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-shrink-0 rounded-full border transition-colors duration-200 ${
        checked
          ? "border-positive bg-positive-deep"
          : "border-line-strong bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-[3px] h-[20px] w-[20px] rounded-full transition-all duration-200 ${
          checked ? "left-[26px] bg-ink" : "left-[3px] bg-muted"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({
  title,
  hint,
  children,
  htmlFor,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
}) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className="min-w-0 flex-1 text-[13.5px] font-semibold"
      >
        {title}
        {hint && (
          <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-faint">
            {hint}
          </span>
        )}
      </Label>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}

export function Stepper({
  value,
  onChange,
  min = -60,
  max = 60,
  suffix = "min",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  label: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div
      className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`${label}: decrease`}
        className="h-8 w-8 rounded-lg text-lg leading-none text-muted transition-colors hover:bg-surface-3 disabled:opacity-30"
      >
        −
      </button>
      <span
        className="tnum min-w-[62px] text-center text-[13px] font-bold"
        aria-live="polite"
      >
        {value > 0 ? "+" : ""}
        {value} {suffix}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`${label}: increase`}
        className="h-8 w-8 rounded-lg text-lg leading-none text-muted transition-colors hover:bg-surface-3 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export function Callout({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "good";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    info: "border-line-strong bg-surface-2 text-muted",
    warn: "border-critical/30 bg-critical/10 text-ink",
    good: "border-positive/30 bg-positive/10 text-ink",
  } as const;
  return (
    <div
      className={`flex gap-2.5 rounded-xl border p-3 text-[12px] leading-relaxed ${tones[tone]}`}
    >
      {icon && (
        <span
          className={`mt-px flex-shrink-0 ${
            tone === "warn"
              ? "text-critical"
              : tone === "good"
                ? "text-positive"
                : "text-faint"
          }`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Card({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      {label && (
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="section-label">{label}</h2>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      {children}
    </section>
  );
}
