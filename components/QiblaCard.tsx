interface QiblaCardProps {
  bearing: number;
  heading: number | null;
  needsPermission: boolean;
  onEnable: () => void;
}

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function QiblaCard({ bearing, heading, needsPermission, onEnable }: QiblaCardProps) {
  const live = heading != null;
  const rot = live ? bearing - heading! : bearing;
  const dir = DIRS[Math.round(bearing / 45) % 8];

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="secthead">
        <span className="t">Qibla</span>
        <span className="line" />
      </div>
      <div className="qibla">
        <div className="compass">
          <div className="ring" />
          <div className="card-n">N</div>
          <div className="kaaba" />
          <div className="needle" style={{ transform: `rotate(${rot}deg)` }}>
            <svg className="arrow" viewBox="0 0 18 52">
              <path d="M9 0 L16 16 L9 11 L2 16 Z" fill="#E8B86A" />
              <line x1="9" y1="11" x2="9" y2="50" stroke="#E8B86A" strokeWidth="2" strokeOpacity=".5" />
            </svg>
          </div>
        </div>
        <div className="deg">{Math.round(bearing)}°</div>
        <div className="dir">{dir} · toward Makkah</div>
        {needsPermission && (
          <button className="calib" onClick={onEnable}>
            Enable live compass
          </button>
        )}
        <div className="hint">
          {live
            ? "Live heading active — turn until the arrow points up."
            : "Face the gold arrow. Hold phone flat for live heading."}
        </div>
      </div>
    </div>
  );
}
