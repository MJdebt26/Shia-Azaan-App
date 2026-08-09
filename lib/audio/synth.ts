import type { AdhanOption } from "@/lib/types";

/**
 * Notification tones generated with the Web Audio API.
 *
 * These exist so the app always has *something* to play: no download, no CDN,
 * no cache miss, and nothing to license. They are also the honest answer for
 * Fajr, where a full adhan is more likely to get notifications disabled than
 * to get anyone to the mosque.
 *
 * Everything is scheduled on the live AudioContext the player already owns.
 * An OfflineAudioContext would mean rendering to a buffer first, which costs a
 * decode step and an extra copy for a three-second sound that we can simply
 * schedule ahead of the clock.
 */

/** The generators the catalogue can request. */
export type SynthKind = NonNullable<AdhanOption["synth"]>;

export interface SynthPlayback {
  /** Fade out and release the scheduled nodes. Safe to call more than once. */
  stop(): void;
  /** Resolves when the sound has finished naturally or was stopped. */
  done: Promise<void>;
}

/** One scheduled oscillator: a partial, a note, or a whole voice. */
interface ToneSpec {
  /** Target frequency in Hz. */
  freq: number;
  /** Offset from the start of the sound, in seconds. */
  at: number;
  /** How long it rings, decay tail included. */
  duration: number;
  /** Peak gain before the master trim. Partials must sum below ~1. */
  gain: number;
  type?: OscillatorType;
  /** Attack in seconds. Long reads as "breathed", short as "struck". */
  attack?: number;
  /** Cents of detune — a little spread stops partials beating mechanically. */
  detune?: number;
  /** Glide up from this frequency, for the call motif's vocal lift. */
  from?: number;
}

/**
 * Overall trim. Partial gains are chosen so a full chord sums to roughly 0.6,
 * leaving headroom before the destination clips on cheap phone speakers.
 */
const MASTER_GAIN = 0.85;

/** Scheduling lead so the first attack is never clipped by clock jitter. */
const LEAD_SECONDS = 0.06;

/** Fade applied when a sound is cut short, long enough to avoid a click. */
const STOP_FADE_SECONDS = 0.08;

/** Floor for exponential ramps — the Web Audio API rejects a target of 0. */
const SILENCE = 0.0001;

// ---------------------------------------------------------------------------
// Voicings
// ---------------------------------------------------------------------------

/**
 * A gentle rising arpeggio (E5–A5–C#6) on pure sines, each note with a slow
 * attack and a long tail. The quiet octave partial adds shimmer without
 * making it brighter, which is what keeps it usable at 4am.
 */
const CHIME: readonly ToneSpec[] = [
  { freq: 659.25, at: 0.0, duration: 1.9, gain: 0.22, attack: 0.05 },
  { freq: 1318.5, at: 0.0, duration: 1.1, gain: 0.04, attack: 0.06 },
  { freq: 880.0, at: 0.26, duration: 2.0, gain: 0.22, attack: 0.05 },
  { freq: 1760.0, at: 0.26, duration: 1.1, gain: 0.035, attack: 0.06 },
  { freq: 1108.73, at: 0.52, duration: 2.4, gain: 0.2, attack: 0.05 },
  { freq: 2217.46, at: 0.52, duration: 1.2, gain: 0.03, attack: 0.06 },
  // A soft low root underneath the last note gives the tail some body.
  { freq: 329.63, at: 0.52, duration: 2.4, gain: 0.07, attack: 0.12 },
];

/**
 * A struck bell on C5. Real bells are inharmonic — hum an octave down, then
 * prime, minor third, fifth and nominal — so the partials use those classic
 * ratios with short, bright upper voices and a long hum. A second, quieter
 * strike keeps it from sounding like a lone beep.
 */
const BELL: readonly ToneSpec[] = [
  { freq: 261.63, at: 0, duration: 3.6, gain: 0.1, attack: 0.02 },
  { freq: 523.25, at: 0, duration: 3.0, gain: 0.2, attack: 0.004 },
  { freq: 622.25, at: 0, duration: 2.2, gain: 0.11, attack: 0.004, detune: 5 },
  { freq: 784.88, at: 0, duration: 1.8, gain: 0.08, attack: 0.003, detune: -6 },
  { freq: 1046.5, at: 0, duration: 1.5, gain: 0.09, attack: 0.002 },
  { freq: 1308.13, at: 0, duration: 0.9, gain: 0.05, attack: 0.002 },
  { freq: 1569.75, at: 0, duration: 0.55, gain: 0.035, attack: 0.002 },
  // The brief top partial is the "clang" of the hammer, not a pitch.
  { freq: 2197.0, at: 0, duration: 0.3, gain: 0.025, attack: 0.001 },

  { freq: 261.63, at: 1.5, duration: 2.7, gain: 0.06, attack: 0.02 },
  { freq: 523.25, at: 1.5, duration: 2.4, gain: 0.12, attack: 0.004 },
  { freq: 622.25, at: 1.5, duration: 1.6, gain: 0.07, attack: 0.004, detune: 4 },
  { freq: 1046.5, at: 1.5, duration: 1.1, gain: 0.055, attack: 0.002 },
  { freq: 1569.75, at: 1.5, duration: 0.45, gain: 0.02, attack: 0.002 },
];

/**
 * Two rising calls (D4 → A4), stated twice, on triangle waves with a short
 * upward glide into the second note. Triangle is reedier than a sine and
 * carries over background noise; the rising fourth reads as a call rather
 * than an alarm. Deliberately abstract — it evokes the cadence of the takbīr
 * without pretending to be a recitation.
 */
const TAKBIR: readonly ToneSpec[] = [
  { freq: 293.66, at: 0.0, duration: 0.55, gain: 0.2, attack: 0.05, type: "triangle" },
  { freq: 146.83, at: 0.0, duration: 0.55, gain: 0.05, attack: 0.06 },
  {
    freq: 440.0,
    at: 0.5,
    duration: 1.0,
    gain: 0.21,
    attack: 0.06,
    type: "triangle",
    from: 392.0,
  },
  { freq: 220.0, at: 0.5, duration: 1.0, gain: 0.05, attack: 0.07 },

  { freq: 293.66, at: 1.7, duration: 0.55, gain: 0.17, attack: 0.05, type: "triangle" },
  { freq: 146.83, at: 1.7, duration: 0.55, gain: 0.045, attack: 0.06 },
  {
    freq: 440.0,
    at: 2.2,
    duration: 1.4,
    gain: 0.19,
    attack: 0.06,
    type: "triangle",
    from: 392.0,
  },
  { freq: 220.0, at: 2.2, duration: 1.4, gain: 0.05, attack: 0.07 },
];

const VOICINGS: Record<SynthKind, readonly ToneSpec[]> = {
  chime: CHIME,
  bell: BELL,
  takbir: TAKBIR,
};

/** Wall-clock length of a generated sound, for previews and UI copy. */
export function synthDurationSeconds(kind: SynthKind): number {
  return VOICINGS[kind].reduce((max, t) => Math.max(max, t.at + t.duration), 0);
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule one oscillator with an attack/decay envelope.
 *
 * The envelope lives on a per-tone gain node rather than on the oscillator so
 * partials can decay at different rates — that difference is most of what
 * makes a bell sound struck instead of buzzed.
 */
function scheduleTone(
  ctx: AudioContext,
  destination: AudioNode,
  spec: ToneSpec,
  t0: number,
): OscillatorNode {
  const start = t0 + spec.at;
  const end = start + spec.duration;
  const attack = Math.min(spec.attack ?? 0.01, spec.duration * 0.5);

  const osc = ctx.createOscillator();
  osc.type = spec.type ?? "sine";
  if (spec.detune) osc.detune.setValueAtTime(spec.detune, start);

  if (spec.from) {
    osc.frequency.setValueAtTime(spec.from, start);
    osc.frequency.exponentialRampToValueAtTime(
      spec.freq,
      start + Math.min(0.12, spec.duration / 3),
    );
  } else {
    osc.frequency.setValueAtTime(spec.freq, start);
  }

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(spec.gain, start + attack);
  // Exponential decay is what the ear reads as "ringing"; linear sounds like a
  // fader being pulled down.
  env.gain.exponentialRampToValueAtTime(SILENCE, end);
  env.gain.setValueAtTime(0, end);

  osc.connect(env);
  env.connect(destination);
  osc.start(start);
  osc.stop(end + 0.02);
  return osc;
}

/**
 * Play a generated tone on an already-running AudioContext.
 *
 * The context is passed in rather than created here: browsers cap how many
 * contexts a page may open, and resuming one after a user gesture is the
 * player's job, not the generator's.
 */
export function playSynth(kind: SynthKind, ctx: AudioContext): SynthPlayback {
  const master = ctx.createGain();
  master.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
  master.connect(ctx.destination);

  const t0 = ctx.currentTime + LEAD_SECONDS;
  const specs = VOICINGS[kind];
  const oscillators = specs.map((spec) => scheduleTone(ctx, master, spec, t0));
  const totalSeconds = LEAD_SECONDS + synthDurationSeconds(kind);

  let settle: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped by its own schedule; nothing to undo.
      }
      osc.disconnect();
    }
    master.disconnect();
    settle();
  };

  timer = setTimeout(finish, Math.ceil(totalSeconds * 1000) + 60);

  const stop = (): void => {
    if (finished) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, SILENCE), now);
    master.gain.exponentialRampToValueAtTime(SILENCE, now + STOP_FADE_SECONDS);
    if (timer !== null) clearTimeout(timer);
    // Let the fade actually run before tearing the graph down, otherwise the
    // abrupt disconnect is audible as a click.
    timer = setTimeout(finish, Math.ceil(STOP_FADE_SECONDS * 1000) + 30);
  };

  return { stop, done };
}
