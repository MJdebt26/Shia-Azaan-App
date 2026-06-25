"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioURL,
  pieceAyahs,
  pieceLabel,
  RECITERS,
  type Piece,
} from "@/lib/reciters";

interface NowPlaying {
  name: string;
  sub: string;
}

const ERR_MSG =
  "Couldn't load this recitation — it needs an internet connection, and some reciters may be unavailable. Try another qāriʾ, or open the app from a hosted link.";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<string[]>([]);
  const idx = useRef(0);

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch {
        /* ignore */
      }
    }
    queue.current = [];
    idx.current = 0;
    setNowPlaying(null);
    setActivePiece(null);
  }, []);

  const playNext = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (idx.current >= queue.current.length) {
      stop();
      return;
    }
    a.src = queue.current[idx.current];
    a.play().catch(() => {
      stop();
      setError(ERR_MSG);
    });
  }, [stop]);

  // Wire the single <audio> element once on mount.
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    const onEnded = () => {
      idx.current += 1;
      playNext();
    };
    const onErr = () => {
      stop();
      setError(ERR_MSG);
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onErr);
      try {
        a.pause();
      } catch {
        /* ignore */
      }
    };
  }, [playNext, stop]);

  const playPiece = useCallback(
    (edition: string, piece: Piece) => {
      setError(null);
      const name = RECITERS.find((r) => r.edition === edition)?.name ?? "";
      queue.current = pieceAyahs(piece).map((ayah) => audioURL(edition, ayah));
      idx.current = 0;
      setActivePiece(piece);
      setNowPlaying({ name, sub: pieceLabel(piece) });
      playNext();
    },
    [playNext],
  );

  const playRaw = useCallback(
    (url: string, label: string, sub: string) => {
      setError(null);
      queue.current = [url];
      idx.current = 0;
      setActivePiece(null);
      setNowPlaying({ name: label, sub });
      playNext();
    },
    [playNext],
  );

  return { nowPlaying, activePiece, error, playPiece, playRaw, stop };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
