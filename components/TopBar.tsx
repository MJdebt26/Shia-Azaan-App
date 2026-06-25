interface TopBarProps {
  greeting: string;
  locName: string;
  onOpenLocation: () => void;
}

export function TopBar({ greeting, locName, onOpenLocation }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="greet">
        <div className="ar">السَّلامُ عَلَيْكُم</div>
        <div className="en">{greeting}</div>
      </div>
      <button className="loc-btn" onClick={onOpenLocation} aria-label="Change location">
        <span className="pin">●</span>
        <span className="name">{locName}</span>
      </button>
    </div>
  );
}
