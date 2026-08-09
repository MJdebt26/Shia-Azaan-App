import type { AdhanOption } from "@/lib/types";
import { playSynth, type SynthPlayback } from "./synth";

/**
 * The single audio engine for the whole app.
 *
 * Three things went wrong in v1 and are fixed here:
 *
 *  1. Failures were swallowed. A 404, a decode error or a blocked autoplay all
 *     produced the same thing — silence — so users concluded "notifications
 *     don't work". Every failure now comes back as a typed `AudioError` and is
 *     also published on the engine state so the UI can say what happened.
 *  2. Autoplay. Browsers refuse to start audio that a user gesture did not
 *     initiate, and both the AudioContext and the <audio> element have to be
 *     woken inside that gesture. `unlock()` does exactly that, once, and the
 *     engine remembers whether it succeeded.
 *  3. Bandwidth. The bundled adhan is 2.5 MB. The element is created with
 *     `preload="none"` and only ever fetches a file that is about to play (or
 *     that `preload()` was explicitly asked to warm).
 *
 * One element and one AudioContext are shared process-wide: overlapping
 * adhans are never wanted, and browsers cap how many contexts a page may open.
 */

export type AudioErrorCode =
  /** No Web Audio / HTMLAudioElement — SSR, or a very old browser. */
  | "unsupported-environment"
  /** The option has no playable source (a "custom" entry with a blank URL). */
  | "no-source"
  /** Autoplay policy refused the request; `unlock()` from a click first. */
  | "blocked"
  /** The file could not be fetched — offline, 404, CORS. */
  | "network"
  /** The file arrived but the browser could not decode it. */
  | "decode"
  | "unknown";

export interface AudioError {
  code: AudioErrorCode;
  /** Sentence shown directly to the user; no jargon, says what to do next. */
  message: string;
  /** Which catalogue option failed, so the UI can mark the right row. */
  optionId: string;
}

export type PlayResult =
  | { ok: true; optionId: string }
  | { ok: false; error: AudioError };

export interface AudioEngineState {
  isPlaying: boolean;
  /** Id of the option currently sounding, or null. */
  playingId: string | null;
  /** True once a user gesture successfully woke the audio pipeline. */
  unlocked: boolean;
  /** Last failure, cleared at the start of every new play attempt. */
  error: AudioError | null;
}

export interface PlayOptions {
  /** Stop after this many milliseconds — used by previews. */
  limitMs?: number;
  /** Fade this long into the tail of `limitMs`, so cuts are not abrupt. */
  fadeMs?: number;
  /** 0–1, applied to file playback only. */
  volume?: number;
  /**
   * Identity of the caller. `stop(owner)` then only stops playback that the
   * same owner started, so one component unmounting cannot cut another's
   * audio short.
   */
  owner?: object;
}

/** How much of a long recording a preview plays before fading out. */
export const PREVIEW_MS = 8_000;

/** Preview fade length — long enough to read as deliberate, short enough to skip. */
export const PREVIEW_FADE_MS = 900;

/** Shared idle snapshot, also used as React's server snapshot. */
export const IDLE_AUDIO_STATE: AudioEngineState = Object.freeze({
  isPlaying: false,
  playingId: null,
  unlocked: false,
  error: null,
});

/**
 * 8 samples of 8 kHz silence. Playing a real file inside the unlock gesture is
 * what convinces iOS Safari that the element is "user initiated"; a data URI
 * keeps that from costing a network round trip.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";

const FADE_STEP_MS = 40;

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return (window.AudioContext as AudioContextCtor | undefined) ?? w.webkitAudioContext ?? null;
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "";
}

function fail(code: AudioErrorCode, message: string, optionId: string): PlayResult {
  return { ok: false, error: { code, message, optionId } };
}

export class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private synth: SynthPlayback | null = null;

  private state: AudioEngineState = IDLE_AUDIO_STATE;
  private readonly listeners = new Set<() => void>();

  /** Bumped on every play/stop; stale async continuations check it and bail. */
  private token = 0;
  private owner: object | null = null;
  private elementPrimed = false;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  // -------------------------------------------------------------------------
  // Subscription (shaped for React's useSyncExternalStore)
  // -------------------------------------------------------------------------

  /** Register for state changes; returns the unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Current snapshot. The identity only changes when something actually
   * changed, which is what stops `useSyncExternalStore` looping forever.
   */
  getState = (): AudioEngineState => this.state;

  get isPlaying(): boolean {
    return this.state.isPlaying;
  }

  get playingId(): string | null {
    return this.state.playingId;
  }

  get unlocked(): boolean {
    return this.state.unlocked;
  }

  private setState(patch: Partial<AudioEngineState>): void {
    const next: AudioEngineState = { ...this.state, ...patch };
    if (
      next.isPlaying === this.state.isPlaying &&
      next.playingId === this.state.playingId &&
      next.unlocked === this.state.unlocked &&
      next.error === this.state.error
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  /** Dismiss the last failure once the user has seen it. */
  clearError(): void {
    if (this.state.error) this.setState({ error: null });
  }

  // -------------------------------------------------------------------------
  // Lazy resources
  // -------------------------------------------------------------------------

  private element(): HTMLAudioElement | null {
    if (this.el) return this.el;
    if (typeof window === "undefined" || typeof Audio === "undefined") return null;

    const el = new Audio();
    // Nothing is fetched until a play or an explicit preload asks for it.
    el.preload = "none";
    el.addEventListener("ended", this.handleEnded);
    el.addEventListener("error", this.handleElementError);
    this.el = el;
    return el;
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = audioContextCtor();
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  private handleEnded = (): void => {
    this.finish();
  };

  private handleElementError = (): void => {
    const media = this.el?.error;
    const optionId = this.state.playingId ?? "";
    if (!media) {
      // Fires when the src is cleared during teardown; nothing to report.
      if (this.state.isPlaying) this.finish();
      return;
    }
    switch (media.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        this.finish();
        return;
      case MediaError.MEDIA_ERR_NETWORK:
        this.failWith("network", "Couldn't download the sound — check your connection.", optionId);
        return;
      case MediaError.MEDIA_ERR_DECODE:
        this.failWith("decode", "That audio file is damaged and can't be played.", optionId);
        return;
      default:
        this.failWith(
          "network",
          "That sound couldn't be loaded — the file may be missing or in an unsupported format.",
          optionId,
        );
    }
  };

  // -------------------------------------------------------------------------
  // Autoplay unlock
  // -------------------------------------------------------------------------

  /**
   * Wake the audio pipeline. MUST be called synchronously from a real user
   * gesture (a click or tap handler) — that is the only moment a browser will
   * let us resume an AudioContext or start an element. Once this succeeds,
   * later playback triggered by a timer is allowed.
   */
  unlock = async (): Promise<boolean> => {
    let ok = false;

    const ctx = this.context();
    if (ctx) {
      try {
        if (ctx.state !== "running") await ctx.resume();
        // iOS additionally wants something actually rendered inside the
        // gesture, so push one silent sample through the graph.
        const source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(1, 1, 22_050);
        source.connect(ctx.destination);
        source.start(0);
        ok = ctx.state === "running";
      } catch {
        ok = false;
      }
    }

    const el = this.element();
    if (el && !this.elementPrimed) {
      const previousVolume = el.volume;
      // Priming replaces the src, so anything already warmed by `preload()`
      // is put back afterwards rather than silently thrown away.
      const previousSrc = el.getAttribute("src");
      try {
        el.muted = true;
        el.src = SILENT_WAV;
        el.load();
        await el.play();
        el.pause();
        el.currentTime = 0;
        this.elementPrimed = true;
        ok = true;
      } catch {
        // Leave `elementPrimed` false so the next gesture can try again.
      } finally {
        el.muted = false;
        el.volume = previousVolume;
        if (previousSrc && previousSrc !== SILENT_WAV) {
          el.src = previousSrc;
          el.load();
        }
      }
    } else if (el && this.elementPrimed) {
      ok = true;
    }

    if (ok) this.setState({ unlocked: true, error: null });
    return ok;
  };

  // -------------------------------------------------------------------------
  // Preloading
  // -------------------------------------------------------------------------

  /**
   * Warm a file so the adhan starts the instant the prayer time arrives.
   *
   * Call this when the user picks a sound, not on page load: the bundled adhan
   * is 2.5 MB and most sessions never play it.
   */
  preload(option: AdhanOption): void {
    if (option.kind !== "file" || !option.src) return;
    const el = this.element();
    if (!el || this.state.isPlaying) return;
    const resolved = this.resolveSrc(option.src);
    if (!resolved || el.src === resolved) return;
    el.preload = "auto";
    el.src = resolved;
    el.load();
  }

  /**
   * Drop the buffered file. Worth doing on low-memory devices after a long
   * adhan, since the decoded audio can hold on to several megabytes.
   */
  release(): void {
    const el = this.el;
    if (!el || this.state.isPlaying) return;
    el.preload = "none";
    el.removeAttribute("src");
    el.load();
  }

  private resolveSrc(src: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Playback
  // -------------------------------------------------------------------------

  /**
   * Play a catalogue option.
   *
   * Resolves as soon as playback is confirmed to have *started* (or to have
   * failed to start) rather than when it ends — an adhan runs for minutes and
   * callers need the success/failure answer immediately. Failures that happen
   * mid-stream are published on the engine state instead.
   */
  play = async (option: AdhanOption, opts: PlayOptions = {}): Promise<PlayResult> => {
    this.halt();
    const token = ++this.token;
    this.owner = opts.owner ?? null;
    this.setState({ isPlaying: false, playingId: null, error: null });

    if (option.kind === "none") {
      // Silence is a valid choice, not a failure: the notification carries it.
      return { ok: true, optionId: option.id };
    }

    if (typeof window === "undefined") {
      return fail("unsupported-environment", "Audio isn't available here.", option.id);
    }

    return option.kind === "synth"
      ? this.playSynthOption(option, opts, token)
      : this.playFileOption(option, opts, token);
  };

  /** Short audition for the settings picker: long files stop after ~8s. */
  preview = (option: AdhanOption, owner?: object): Promise<PlayResult> =>
    this.play(option, {
      limitMs: PREVIEW_MS,
      fadeMs: PREVIEW_FADE_MS,
      owner,
    });

  private async playSynthOption(
    option: AdhanOption,
    opts: PlayOptions,
    token: number,
  ): Promise<PlayResult> {
    if (!option.synth) {
      return fail("no-source", "This tone is missing its definition.", option.id);
    }
    const ctx = this.context();
    if (!ctx) {
      return fail(
        "unsupported-environment",
        "This browser can't generate sounds. Pick one of the recorded adhans instead.",
        option.id,
      );
    }
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // Fall through to the blocked check below with a real state value.
      }
    }
    if (this.token !== token) return { ok: true, optionId: option.id };
    if (ctx.state !== "running") {
      return this.failWith(
        "blocked",
        "Your browser blocked the sound. Tap anywhere in the app once to allow audio.",
        option.id,
      );
    }

    const playback = playSynth(option.synth, ctx);
    this.synth = playback;
    this.setState({ isPlaying: true, playingId: option.id });
    void playback.done.then(() => {
      if (this.token === token) this.finish();
    });
    if (opts.limitMs) {
      this.limitTimer = setTimeout(() => {
        if (this.token === token) playback.stop();
      }, opts.limitMs);
    }
    return { ok: true, optionId: option.id };
  }

  private async playFileOption(
    option: AdhanOption,
    opts: PlayOptions,
    token: number,
  ): Promise<PlayResult> {
    const el = this.element();
    if (!el) {
      return fail("unsupported-environment", "Audio isn't available here.", option.id);
    }
    if (!option.src) {
      return fail(
        "no-source",
        "No audio file is set for this option. Add a link in Advanced, or choose a built-in sound.",
        option.id,
      );
    }
    const resolved = this.resolveSrc(option.src);
    if (!resolved) {
      return fail("no-source", "That audio link isn't a valid URL.", option.id);
    }

    if (el.src !== resolved) {
      el.preload = "auto";
      el.src = resolved;
      el.load();
    }
    el.loop = false;
    el.volume = Math.min(1, Math.max(0, opts.volume ?? 1));
    try {
      el.currentTime = 0;
    } catch {
      // Not seekable yet; playback starts from the beginning regardless.
    }

    this.setState({ isPlaying: true, playingId: option.id });
    try {
      await el.play();
    } catch (err) {
      if (this.token !== token) return { ok: true, optionId: option.id };
      const name = errorName(err);
      if (name === "NotAllowedError") {
        return this.failWith(
          "blocked",
          "Your browser blocked the adhan. Tap anywhere in the app once to allow audio.",
          option.id,
        );
      }
      if (name === "NotSupportedError") {
        return this.failWith(
          "network",
          "That sound couldn't be loaded — the file may be missing or in an unsupported format.",
          option.id,
        );
      }
      if (name === "AbortError") {
        // A newer play() replaced this one; the newer call owns the state.
        return { ok: true, optionId: option.id };
      }
      return this.failWith("unknown", "The sound couldn't be played.", option.id);
    }

    if (this.token !== token) return { ok: true, optionId: option.id };

    // The element started, so the pipeline is demonstrably awake.
    if (!this.state.unlocked) this.setState({ unlocked: true });

    if (opts.limitMs) {
      const fade = Math.min(opts.fadeMs ?? PREVIEW_FADE_MS, opts.limitMs);
      this.limitTimer = setTimeout(
        () => {
          if (this.token === token) this.fadeOutAndFinish(fade);
        },
        Math.max(0, opts.limitMs - fade),
      );
    }
    return { ok: true, optionId: option.id };
  }

  // -------------------------------------------------------------------------
  // Stopping
  // -------------------------------------------------------------------------

  /**
   * Stop whatever is playing. Pass the `owner` used at play time to make the
   * stop conditional — an unmounting component should not silence audio some
   * other part of the app started.
   */
  stop = (owner?: object): void => {
    if (owner && this.owner !== owner) return;
    this.token += 1;
    this.halt();
    this.setState({ isPlaying: false, playingId: null });
    this.owner = null;
  };

  /** Tear down timers and sound sources without touching the public state. */
  private halt(): void {
    this.clearTimers();
    if (this.synth) {
      this.synth.stop();
      this.synth = null;
    }
    const el = this.el;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        // Nothing loaded yet.
      }
      el.volume = 1;
    }
  }

  private clearTimers(): void {
    if (this.limitTimer !== null) {
      clearTimeout(this.limitTimer);
      this.limitTimer = null;
    }
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  /**
   * Ramp the element's volume down before stopping.
   *
   * HTMLAudioElement has no parameter automation, so this steps `volume` on a
   * timer. Routing the element through the AudioContext for a real ramp would
   * mean a permanent MediaElementSource, and if the context were ever
   * suspended the adhan would play to nowhere — a worse failure than a
   * slightly coarse fade.
   */
  private fadeOutAndFinish(ms: number): void {
    const el = this.el;
    if (!el) {
      this.finish();
      return;
    }
    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
    const from = el.volume;
    let step = 0;
    this.clearTimers();
    this.fadeTimer = setInterval(() => {
      step += 1;
      el.volume = Math.max(0, from * (1 - step / steps));
      if (step >= steps) this.finish();
    }, FADE_STEP_MS);
  }

  /** Playback reached its natural end (or a preview limit). */
  private finish(): void {
    this.halt();
    this.owner = null;
    this.setState({ isPlaying: false, playingId: null });
  }

  private failWith(code: AudioErrorCode, message: string, optionId: string): PlayResult {
    this.halt();
    this.owner = null;
    const error: AudioError = { code, message, optionId };
    this.setState({ isPlaying: false, playingId: null, error });
    return { ok: false, error };
  }
}

let engine: AudioEngine | null = null;

/**
 * The process-wide engine, created on first use.
 *
 * Lazy rather than a module-level constant so importing this file from a
 * server component (or a test) never constructs browser objects.
 */
export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
