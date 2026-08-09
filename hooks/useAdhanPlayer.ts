"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { AdhanOption } from "@/lib/types";
import {
  getAudioEngine,
  IDLE_AUDIO_STATE,
  type AudioEngineState,
  type AudioError,
  type PlayResult,
} from "@/lib/audio/player";

/**
 * React binding for the shared AudioEngine.
 *
 * The engine deliberately lives outside React: the adhan has to keep playing
 * while screens mount and unmount, and only one sound may ever be audible.
 * This hook subscribes to it with `useSyncExternalStore`, so every component
 * that uses it sees the same `isPlaying`/`playingId` without any state being
 * duplicated or drifting.
 */

export interface AdhanPlayer {
  /** Play in full. Resolves once playback has started, or failed to. */
  play(option: AdhanOption): Promise<PlayResult>;
  /** Audition in the picker — long recordings fade out after ~8 seconds. */
  preview(option: AdhanOption): Promise<PlayResult>;
  stop(): void;
  /** Warm a file so the adhan starts instantly when the prayer time arrives. */
  preload(option: AdhanOption): void;
  isPlaying: boolean;
  playingId: string | null;
  /** Last failure — a real message, not silence. Null once dismissed. */
  error: AudioError | null;
  clearError(): void;
  /** True once a user gesture has woken the audio pipeline. */
  unlocked: boolean;
  /** Call from a real click/tap handler; browsers ignore it otherwise. */
  unlock(): Promise<boolean>;
}

/**
 * Server render has no engine and no gesture, so React gets a frozen idle
 * snapshot. It matches the client's first snapshot (`unlocked` cannot be true
 * before hydration), which keeps hydration warning-free.
 */
function serverSnapshot(): AudioEngineState {
  return IDLE_AUDIO_STATE;
}

export function useAdhanPlayer(): AdhanPlayer {
  // A per-hook identity so unmount cleanup only stops playback this instance
  // started. Held in state rather than a ref because it is read during render
  // (the callbacks close over it) and must never change afterwards.
  const [owner] = useState<object>(() => ({}));

  const subscribe = useCallback(
    (onChange: () => void) => getAudioEngine().subscribe(onChange),
    [],
  );
  const getSnapshot = useCallback(() => getAudioEngine().getState(), []);
  const state = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  const play = useCallback(
    (option: AdhanOption) => getAudioEngine().play(option, { owner }),
    [owner],
  );

  const preview = useCallback(
    (option: AdhanOption) => getAudioEngine().preview(option, owner),
    [owner],
  );

  // The user asking for silence means all of it, so this stop is unconditional
  // — unlike the owner-scoped stop used on unmount.
  const stop = useCallback(() => {
    getAudioEngine().stop();
  }, []);

  const preload = useCallback((option: AdhanOption) => {
    getAudioEngine().preload(option);
  }, []);

  const unlock = useCallback(() => getAudioEngine().unlock(), []);

  const clearError = useCallback(() => {
    getAudioEngine().clearError();
  }, []);

  useEffect(
    () => () => {
      // Leaving the settings screen should cut its own preview, but never an
      // adhan that the alert scheduler started.
      getAudioEngine().stop(owner);
    },
    [owner],
  );

  return useMemo(
    () => ({
      play,
      preview,
      stop,
      preload,
      isPlaying: state.isPlaying,
      playingId: state.playingId,
      error: state.error,
      clearError,
      unlocked: state.unlocked,
      unlock,
    }),
    [play, preview, stop, preload, state, clearError, unlock],
  );
}
