"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Callout } from "@/components/ui/Controls";
import { IconCheck, IconPlay, IconStop, IconWarn } from "@/components/ui/Icon";
import {
  ADHAN_GROUPS,
  CUSTOM_ADHAN_ID,
  adhanLengthLabel,
  customAdhanOption,
  getAdhanOption,
} from "@/lib/audio/catalog";
import type { AdhanOption } from "@/lib/types";

/**
 * The sound picker.
 *
 * v1 required pasting an .mp3 URL, which meant almost nobody ended up with a
 * working adhan. Everything offered here is either bundled with the app or
 * synthesised on the device, so it plays offline and cannot 404. Every option
 * can be auditioned before it is chosen — and that tap doubles as the browser's
 * required autoplay unlock, which is the other half of why alerts now actually
 * make sound.
 */

/**
 * The slice of `useAdhanPlayer` the picker needs. Structural typing keeps this
 * component testable without standing up the whole audio engine.
 */
export interface AdhanPlayerLike {
  playingId: string | null;
  error: { message: string; optionId: string } | null;
  preview: (option: AdhanOption) => Promise<unknown>;
  stop: () => void;
  unlock: () => Promise<boolean>;
}

interface AdhanPickerProps {
  open: boolean;
  onClose: () => void;
  /** Which prayer this choice applies to, for the sheet title. */
  forLabel: string;
  value: string;
  customUrl: string;
  onChange: (id: string, customUrl?: string) => void;
  player: AdhanPlayerLike;
}

export function AdhanPicker({
  open,
  onClose,
  forLabel,
  value,
  customUrl,
  onChange,
  player,
}: AdhanPickerProps) {
  const [draftUrl, setDraftUrl] = useState(customUrl);

  const close = () => {
    player.stop();
    onClose();
  };

  const audition = (option: AdhanOption) => {
    if (player.playingId === option.id) {
      player.stop();
      return;
    }
    void player.unlock().then(() => player.preview(option));
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Sound for ${forLabel}`}
      description="Tap play to hear it before choosing."
    >
      <div className="space-y-5 pb-2">
        {player.error && (
          <Callout tone="warn" icon={<IconWarn size={15} />}>
            {player.error.message}
          </Callout>
        )}

        {ADHAN_GROUPS.filter((g) => g.id !== "advanced").map((group) => (
          <div key={group.id}>
            <h3 className="section-label">{group.title}</h3>
            <p className="mb-2 mt-1 text-[11px] text-faint">{group.blurb}</p>
            <ul className="space-y-2">
              {group.options.map((option) => {
                const selected = option.id === value;
                const playing = player.playingId === option.id;
                const length = adhanLengthLabel(option);
                return (
                  <li key={option.id}>
                    <div
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                        selected
                          ? "border-accent/50 bg-accent/10"
                          : "border-line bg-surface"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onChange(option.id)}
                        aria-pressed={selected}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2 text-[14px] font-semibold">
                          {option.label}
                          {selected && (
                            <IconCheck size={15} className="text-accent" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">
                          {option.detail}
                          {length ? ` · ${length}` : ""}
                        </span>
                        {option.licence && (
                          <span className="mt-0.5 block text-[10px] text-faint/70">
                            {option.licence}
                          </span>
                        )}
                      </button>

                      {option.kind !== "none" && (
                        <button
                          type="button"
                          onClick={() => audition(option)}
                          aria-label={
                            playing
                              ? `Stop ${option.label}`
                              : `Play ${option.label}`
                          }
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                            playing
                              ? "border-positive/50 bg-positive/15 text-positive"
                              : "border-line-strong bg-surface-2 text-muted hover:bg-surface-3"
                          }`}
                        >
                          {playing ? <IconStop size={16} /> : <IconPlay size={16} />}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Advanced escape hatch — deliberately last and understated. */}
        <details
          className="rounded-xl border border-line bg-surface p-3"
          open={value === CUSTOM_ADHAN_ID}
        >
          <summary className="cursor-pointer text-[13px] font-semibold text-muted">
            Use my own audio file
          </summary>
          <div className="mt-3 space-y-2">
            <label
              htmlFor="custom-adhan-url"
              className="block text-[11px] font-semibold text-faint"
            >
              Direct link to an audio file
            </label>
            <input
              id="custom-adhan-url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/adhan.mp3"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-[16px] text-ink placeholder:text-faint/60"
            />
            <p className="text-[11px] leading-snug text-faint">
              Served over HTTPS as a direct file link. Unlike the built-in
              sounds, this one needs a connection to play.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!draftUrl.trim()}
                onClick={() => audition(customAdhanOption(draftUrl))}
                className="btn btn-quiet flex-1 disabled:opacity-40"
              >
                Test
              </button>
              <button
                type="button"
                disabled={!draftUrl.trim()}
                onClick={() => {
                  onChange(CUSTOM_ADHAN_ID, draftUrl.trim());
                  close();
                }}
                className="btn btn-primary flex-1 disabled:opacity-40"
              >
                Use this
              </button>
            </div>
          </div>
        </details>

        <p className="pb-2 text-center text-[11px] text-faint">
          Currently selected:{" "}
          <strong className="text-muted">
            {getAdhanOption(value, customUrl).label}
          </strong>
        </p>
      </div>
    </Sheet>
  );
}
