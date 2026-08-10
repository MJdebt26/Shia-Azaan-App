"use client";

import { useState } from "react";
import { Card, Divider, Row, Segmented, Stepper } from "@/components/ui/Controls";
import { Callout } from "@/components/ui/Controls";
import { IconInfo } from "@/components/ui/Icon";
import { METHODS, JAFARI_METHODS, OTHER_METHODS } from "@/lib/prayer/methods";
import { PRAYERS } from "@/lib/constants";
import type { AsrFactor, CalcSettings, HighLatRule, MethodKey } from "@/lib/types";

/**
 * Calculation settings.
 *
 * v1 offered two methods and hardcoded everything else. The high-latitude rule
 * in particular was fixed at half-night, which silently produced wrong Fajr and
 * Isha for anyone north of roughly 48° — a large share of the diaspora this app
 * is built for. All of it is now explicit and explained.
 */

const HIGH_LAT_OPTIONS: ReadonlyArray<{
  value: HighLatRule;
  label: string;
  blurb: string;
}> = [
  {
    value: "angle_based",
    label: "Angle-based",
    blurb:
      "Splits the night in proportion to the twilight angle. The most widely published rule, and what most printed timetables use.",
  },
  {
    value: "middle_of_night",
    label: "Middle of the night",
    blurb:
      "Fajr and Isha are pinned to the midpoint of the night. Conservative and simple.",
  },
  {
    value: "one_seventh",
    label: "One seventh",
    blurb:
      "Divides the night into sevenths. Produces a later Fajr and earlier Isha in summer.",
  },
  {
    value: "none",
    label: "None",
    blurb:
      "Use the true angle only. In high-summer this can leave Fajr and Isha undefined or very close together.",
  },
];

interface CalculationCardProps {
  calc: CalcSettings;
  onChange: (next: CalcSettings) => void;
  /** True when the user's latitude makes the high-latitude rule matter. */
  highLatRelevant: boolean;
}

export function CalculationCard({
  calc,
  onChange,
  highLatRelevant,
}: CalculationCardProps) {
  const [showAdjust, setShowAdjust] = useState(false);
  const method = METHODS[calc.method];
  const set = (patch: Partial<CalcSettings>) => onChange({ ...calc, ...patch });

  return (
    <Card label="Calculation">
      <Row title="Method" hint={method.description}>
        <span className="sr-only">Calculation method</span>
      </Row>
      <select
        value={calc.method}
        onChange={(e) => set({ method: e.target.value as MethodKey })}
        aria-label="Calculation method"
        className="w-full appearance-none rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-[16px] font-semibold text-ink"
      >
        <optgroup label="Ja'fari (Shia)">
          {JAFARI_METHODS.map((k) => (
            <option key={k} value={k}>
              {METHODS[k].label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Other schools">
          {OTHER_METHODS.map((k) => (
            <option key={k} value={k}>
              {METHODS[k].label}
            </option>
          ))}
        </optgroup>
      </select>

      {calc.method === "custom" && (
        <div className="mt-3 space-y-3 rounded-xl bg-surface p-3">
          <Row title="Fajr angle" hint="Degrees below the horizon">
            <Stepper
              label="Fajr angle"
              value={calc.customFajrAngle}
              min={10}
              max={22}
              suffix="°"
              onChange={(v) => set({ customFajrAngle: v })}
            />
          </Row>
          <Divider />
          <Row title="Isha angle" hint="Degrees below the horizon">
            <Stepper
              label="Isha angle"
              value={calc.customIshaAngle}
              min={10}
              max={22}
              suffix="°"
              onChange={(v) => set({ customIshaAngle: v })}
            />
          </Row>
        </div>
      )}

      <Divider />

      <Row
        title="Asr shadow"
        hint={
          calc.asrFactor === 1
            ? "Shadow equal to the object's length — the majority and Ja'fari view."
            : "Shadow twice the object's length — the Hanafi view."
        }
      >
        <Segmented
          label="Asr shadow factor"
          value={String(calc.asrFactor)}
          options={[
            { value: "1", label: "Standard" },
            { value: "2", label: "Hanafi" },
          ]}
          onChange={(v) => set({ asrFactor: Number(v) as AsrFactor })}
        />
      </Row>

      <Divider />

      <Row title="Imsāk before Fajr" hint="When the fast begins.">
        <Stepper
          label="Imsak minutes"
          value={calc.imsakMinutes}
          min={0}
          max={45}
          onChange={(v) => set({ imsakMinutes: v })}
        />
      </Row>

      <Divider />

      <div className="py-3">
        <p className="text-[13.5px] font-semibold">High-latitude rule</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-faint">
          What to do in summer when the sun never sinks far enough for a true
          Fajr or Isha.
        </p>
        <div className="mt-2.5 space-y-1.5">
          {HIGH_LAT_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-2.5 rounded-xl border p-2.5 transition-colors ${
                calc.highLatRule === o.value
                  ? "border-accent/50 bg-accent/10"
                  : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="high-lat-rule"
                value={o.value}
                checked={calc.highLatRule === o.value}
                onChange={() => set({ highLatRule: o.value })}
                className="mt-1 h-3.5 w-3.5 flex-shrink-0 accent-[rgb(var(--c-accent))]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                  {o.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>
        {!highLatRelevant && (
          <p className="mt-2 text-[11px] text-faint">
            At your latitude this rule rarely changes anything.
          </p>
        )}
      </div>

      <Divider />

      <button
        type="button"
        onClick={() => setShowAdjust((v) => !v)}
        aria-expanded={showAdjust}
        className="w-full py-3 text-left text-[13.5px] font-semibold"
      >
        Manual adjustments
        <span className="mt-0.5 block text-[11.5px] font-medium text-faint">
          Nudge individual times to match your local masjid.
        </span>
      </button>

      {showAdjust && (
        <div className="space-y-2 rounded-xl bg-surface p-3">
          {PRAYERS.map((p) => (
            <Row key={p.key} title={p.en}>
              <Stepper
                label={`${p.en} adjustment`}
                value={calc.adjustments[p.key]}
                min={-60}
                max={60}
                onChange={(v) =>
                  set({ adjustments: { ...calc.adjustments, [p.key]: v } })
                }
              />
            </Row>
          ))}
          <button
            type="button"
            onClick={() =>
              set({
                adjustments: {
                  fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0,
                },
              })
            }
            className="btn btn-quiet w-full !min-h-0 !py-2 text-[12.5px]"
          >
            Reset all to zero
          </button>
        </div>
      )}

      <Callout icon={<IconInfo size={15} />}>
        Times are computed on your device from your coordinates — nothing is
        fetched. Verify the first days of a new Hijri month with your local
        community.
      </Callout>
    </Card>
  );
}
