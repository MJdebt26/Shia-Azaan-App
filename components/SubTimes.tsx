import { fmtTime } from "@/lib/time";
import type { Times } from "@/lib/types";

interface SubTimesProps {
  times: Times;
  fmt24: boolean;
}

export function SubTimes({ times, fmt24 }: SubTimesProps) {
  const im = fmtTime(times.imsak, fmt24);
  const mid = fmtTime(times.midnight, fmt24);
  return (
    <div className="card" style={{ marginTop: -2 }}>
      <div className="subtimes">
        <div className="stchip">
          <span className="k">Imsāk</span>
          <b>
            {im.h}
            {im.ap ? " " + im.ap : ""}
          </b>
        </div>
        <div className="stchip">
          <span className="k">Islamic Midnight</span>
          <b>
            {mid.h}
            {mid.ap ? " " + mid.ap : ""}
          </b>
        </div>
      </div>
    </div>
  );
}
