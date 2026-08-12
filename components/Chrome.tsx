"use client";

import { IconCalendar, IconCompass, IconPin, IconSettings } from "./ui/Icon";

/** App chrome: the header and the bottom tab bar. */

export type TabId = "today" | "qibla" | "settings";

export function Header({
  greeting,
  locationName,
  gregorian,
  hijri,
  onOpenLocation,
}: {
  greeting: string;
  locationName: string;
  gregorian: string;
  hijri: string;
  onOpenLocation: () => void;
}) {
  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-arabic text-[23px] leading-none text-accent-bright">
            السَّلامُ عَلَيْكُم
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-muted">
            {greeting}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenLocation}
          className="flex max-w-[46%] flex-shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          <span className="text-accent">
            <IconPin size={14} />
          </span>
          <span className="truncate">{locationName}</span>
          <span className="sr-only">— change location</span>
        </button>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-faint">
        <span className="font-semibold text-muted">{gregorian}</span>
        {hijri && (
          <>
            <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-faint" />
            <span className="font-semibold text-accent">{hijri}</span>
          </>
        )}
      </p>
    </header>
  );
}

const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  Icon: typeof IconCalendar;
}> = [
  { id: "today", label: "Today", Icon: IconCalendar },
  { id: "qibla", label: "Qibla", Icon: IconCompass },
  { id: "settings", label: "Settings", Icon: IconSettings },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      // Opaque, not translucent-plus-blur. A fixed, full-width backdrop-blur
      // pinned over a long scrolling page is the single most expensive thing to
      // ask iOS Safari to composite — it re-rasterises on every scroll frame,
      // and on a phone that shows up as a page that will not move. The bar sits
      // over the sky-tinted background, so near-opaque reads the same.
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-app">
        {TABS.map(({ id, label, Icon }) => {
          const selected = id === active;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={selected ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold uppercase tracking-wider transition-colors ${
                  selected ? "text-accent" : "text-faint"
                }`}
              >
                <Icon size={21} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footnote() {
  return (
    <footer className="pb-2 pt-6 text-center text-[10.5px] leading-relaxed text-faint">
      <p className="font-arabic mb-1.5 text-[15px] text-accent">
        إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا
      </p>
      <p>
        Indeed, prayer is prescribed for the believers at fixed times.{" "}
        <span className="text-muted">— Qurʾān 4:103</span>
      </p>
    </footer>
  );
}
