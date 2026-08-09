import type { AdhanOption } from "@/lib/types";

/**
 * The built-in adhan catalogue.
 *
 * In v1 the only way to get an adhan was to paste an .mp3 URL into a text box.
 * That put the burden of finding, hosting and licensing audio on the user, and
 * a typo produced silence with no explanation — the single biggest complaint
 * about the old build. Everything the picker offers now lives in this file:
 * two bundled recordings that ship with the app, three tones generated on the
 * device, and an explicit "silent" choice. A custom URL survives only as an
 * advanced escape hatch, listed last and clearly marked.
 *
 * Every entry except "custom" plays with no network connection, which matters
 * because the whole point of computing prayer times locally is that the app
 * keeps working offline.
 */

/** Chosen when no preference is stored, and the fallback for unknown ids. */
export const DEFAULT_ADHAN_ID = "adhan-fakhri";

/**
 * Fajr defaults to this instead of a full adhan: a three-minute recitation at
 * 4am is why people switch prayer notifications off entirely.
 * Mirrors `DEFAULT_ALERTS.fajr.soundId` in lib/constants.ts.
 */
export const DEFAULT_FAJR_ADHAN_ID = "chime";

/** Notification appears, nothing is played. */
export const SILENT_ADHAN_ID = "none";

/** The advanced "bring your own URL" entry. */
export const CUSTOM_ADHAN_ID = "custom";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Bundled recordings. Both files live in `public/audio/`, are served from our
 * own origin (so the service worker can cache them) and carry licences that
 * permit redistribution — recorded here so the credits panel never has to
 * guess.
 */
const FILE_OPTIONS: readonly AdhanOption[] = [
  {
    id: "adhan-fakhri",
    label: "Adhan — Sabah Fakhri",
    detail: "Classical Syrian recitation",
    kind: "file",
    src: "/audio/adhan-fakhri.mp3",
    licence: "Public domain, via Wikimedia Commons",
    seconds: 158,
  },
  {
    id: "adhan-azeez",
    label: "Adhan — Aaqib Azeez",
    detail: "Clear, measured recitation",
    kind: "file",
    src: "/audio/adhan-azeez.mp3",
    licence: "CC BY-SA 4.0, via Wikimedia Commons",
    seconds: 87,
  },
] as const;

/**
 * Generated with the Web Audio API at play time. They add zero bytes to the
 * download, always work offline, and are short enough to use as a repeating
 * daily alert without becoming an irritation.
 */
const SYNTH_OPTIONS: readonly AdhanOption[] = [
  {
    id: "chime",
    label: "Chime",
    detail: "Soft three-note arpeggio — gentle enough for Fajr",
    kind: "synth",
    synth: "chime",
    licence: "Generated on your device",
    seconds: 3,
  },
  {
    id: "bell",
    label: "Bell",
    detail: "A struck bell, warm and quick to fade",
    kind: "synth",
    synth: "bell",
    licence: "Generated on your device",
    seconds: 4,
  },
  {
    id: "takbir",
    label: "Takbīr motif",
    detail: "Short two-tone call, synthesised (not a recitation)",
    kind: "synth",
    synth: "takbir",
    licence: "Generated on your device",
    seconds: 4,
  },
] as const;

const SILENT_OPTION: AdhanOption = {
  id: SILENT_ADHAN_ID,
  label: "Silent",
  detail: "System notification only — no sound",
  kind: "none",
  seconds: 0,
};

/**
 * Template for the advanced escape hatch. It carries no `src`; the URL the
 * user typed is spliced in by `customAdhanOption` so the stored settings only
 * ever hold the id plus the URL, and a blank URL degrades to silence rather
 * than to a broken player.
 */
const CUSTOM_OPTION: AdhanOption = {
  id: CUSTOM_ADHAN_ID,
  label: "Custom URL",
  detail: "Advanced — a direct link to an audio file you host",
  kind: "file",
  licence: "You are responsible for the file you link to",
};

/** Every option the picker can show, in display order. */
export const ADHAN_OPTIONS: readonly AdhanOption[] = [
  ...FILE_OPTIONS,
  ...SYNTH_OPTIONS,
  SILENT_OPTION,
  CUSTOM_OPTION,
] as const;

// ---------------------------------------------------------------------------
// Grouping for the picker
// ---------------------------------------------------------------------------

export type AdhanGroupId = "adhan" | "tones" | "quiet" | "advanced";

export interface AdhanGroup {
  id: AdhanGroupId;
  title: string;
  /** One line of context shown under the group heading. */
  blurb: string;
  options: readonly AdhanOption[];
}

/**
 * The picker's sections. Grouping lives here rather than in the component so
 * the settings screen and the preview sheet can never drift apart, and so the
 * ordering decision — full adhans first, the URL box last — is stated once.
 */
export const ADHAN_GROUPS: readonly AdhanGroup[] = [
  {
    id: "adhan",
    title: "Adhan",
    blurb: "Bundled with the app — no download, works offline.",
    options: FILE_OPTIONS,
  },
  {
    id: "tones",
    title: "Short tones",
    blurb: "Generated on your device. Good for Fajr or a quiet office.",
    options: SYNTH_OPTIONS,
  },
  {
    id: "quiet",
    title: "No sound",
    blurb: "The notification still appears at the prayer time.",
    options: [SILENT_OPTION],
  },
  {
    id: "advanced",
    title: "Advanced",
    blurb: "Only if you host your own file. Needs a connection to play.",
    options: [CUSTOM_OPTION],
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const BY_ID: ReadonlyMap<string, AdhanOption> = new Map(
  ADHAN_OPTIONS.map((option) => [option.id, option]),
);

/** Exact lookup — undefined for ids that are not in the catalogue. */
export function findAdhanOption(id: string): AdhanOption | undefined {
  return BY_ID.get(id);
}

/**
 * Build the playable option for a user-supplied URL.
 *
 * Kept separate from the catalogue because the URL is user data: it lives in
 * settings, not in this module, and it must be re-validated every time rather
 * than baked into a shared object.
 */
export function customAdhanOption(url: string): AdhanOption {
  return { ...CUSTOM_OPTION, src: url.trim() };
}

/**
 * Resolve a stored `soundId` to something that can actually be played.
 *
 * Alert settings are persisted in localStorage, so an id can outlive the
 * option it named (a renamed file, a shared settings blob, a downgrade). This
 * never returns undefined: an unknown id falls back to the default adhan, and
 * "custom" without a usable URL falls back to silence — a missed sound the
 * user chose is better than a surprise three-minute adhan they did not.
 */
export function getAdhanOption(
  id: string | null | undefined,
  customUrl?: string | null,
): AdhanOption {
  if (id === CUSTOM_ADHAN_ID) {
    const url = customUrl?.trim();
    return url ? customAdhanOption(url) : SILENT_OPTION;
  }
  if (!id) return BY_ID.get(DEFAULT_ADHAN_ID) ?? SILENT_OPTION;
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_ADHAN_ID) ?? SILENT_OPTION;
}

/**
 * True when playing this option requires a connection.
 *
 * Used by the picker to warn that the advanced URL is the one choice that can
 * fail on a plane or in a basement, unlike everything else in the catalogue.
 */
export function adhanNeedsNetwork(option: AdhanOption): boolean {
  if (option.kind !== "file" || !option.src) return false;
  return /^https?:\/\//i.test(option.src);
}

/** Human-readable duration for the picker, e.g. "2:38" or "3s". */
export function adhanLengthLabel(option: AdhanOption): string {
  const seconds = option.seconds ?? 0;
  if (!seconds) return "";
  if (seconds < 20) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
