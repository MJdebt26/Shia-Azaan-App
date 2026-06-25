import { PrayerIcon } from "./icons";
import { PRAYERS } from "@/lib/constants";
import { fmtTime } from "@/lib/time";
import type { Times } from "@/lib/types";

interface PrayerListProps {
  times: Times;
  currentIndex: number;
  fmt24: boolean;
}

export function PrayerList({ times, currentIndex, fmt24 }: PrayerListProps) {
  return (
    <div className="card" id="prayerList">
      {PRAYERS.map((p, i) => {
        const t = fmtTime(times[p.key], fmt24);
        const active = i === currentIndex;
        return (
          <div key={p.key} className={`prow ${active ? "active" : ""}`}>
            <div className="picon">
              <PrayerIcon name={p.icon} />
            </div>
            <div className="pmeta">
              <div className="nm">
                {p.en}
                <span className="ar">{p.ar}</span>
                {active && <span className="nowtag">now</span>}
              </div>
              {p.sub && <div className="sub">{p.sub}</div>}
            </div>
            <div className="ptime">
              {t.h}
              <span className="ap">{t.ap}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
