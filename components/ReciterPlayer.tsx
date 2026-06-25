"use client";

import { RECITERS } from "@/lib/reciters";
import type { AudioPlayer } from "@/hooks/useAudioPlayer";

interface ReciterPlayerProps {
  edition: string;
  onChangeReciter: (edition: string) => void;
  player: AudioPlayer;
}

export function ReciterPlayer({ edition, onChangeReciter, player }: ReciterPlayerProps) {
  const { nowPlaying, activePiece, error, playPiece, stop } = player;

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="secthead">
        <span className="t">Reciters</span>
        <span className="line" />
      </div>
      <div className="recwrap">
        <div className="recsub">Listen to renowned qāriʾ</div>
        <div className="recsel">
          <select
            className="rec"
            value={edition}
            onChange={(e) => onChangeReciter(e.target.value)}
            aria-label="Choose reciter"
          >
            {RECITERS.map((r) => (
              <option key={r.edition} value={r.edition}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="recbtns">
          <button
            className={`pbtn ${activePiece === "fatiha" ? "playing" : ""}`}
            onClick={() => playPiece(edition, "fatiha")}
          >
            <span className="ico">▶</span> Al-Fātiḥa
          </button>
          <button
            className={`pbtn ${activePiece === "kursi" ? "playing" : ""}`}
            onClick={() => playPiece(edition, "kursi")}
          >
            <span className="ico">▶</span> Āyat al-Kursī
          </button>
        </div>

        {nowPlaying && (
          <div className="nowplaying show">
            <div className="eq">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="meta">
              <b>{nowPlaying.name}</b>
              <div className="s">{nowPlaying.sub}</div>
            </div>
            <button className="npstop" onClick={stop} aria-label="Stop">
              ■
            </button>
          </div>
        )}

        {error && <div className="recerr show">{error}</div>}
      </div>
    </div>
  );
}
