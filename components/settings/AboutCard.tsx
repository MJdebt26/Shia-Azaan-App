"use client";

import { Card } from "@/components/ui/Controls";
import { ADHAN_OPTIONS } from "@/lib/audio/catalog";

/**
 * Credits.
 *
 * Two of the bundled adhans carry share-alike terms, so attribution is not
 * optional — it is rendered from the same catalogue the picker uses, which
 * means a new sound can never ship without its licence coming along.
 */
export function AboutCard({ version }: { version: string }) {
  const credited = ADHAN_OPTIONS.filter(
    (o) => o.kind === "file" && o.licence && o.id !== "custom",
  );

  return (
    <Card label="About">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Awqāt computes Ja&apos;fari prayer times locally from your coordinates
        using a low-precision solar model from the <em>Astronomical Almanac</em>.
        Nothing about your location leaves the device unless you turn on
        background alerts.
      </p>

      <div className="mt-4">
        <h3 className="section-label mb-2">Audio credits</h3>
        <ul className="space-y-1.5">
          {credited.map((o) => (
            <li key={o.id} className="text-[11.5px] leading-snug text-faint">
              <span className="font-semibold text-muted">{o.label}</span> —{" "}
              {o.licence}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h3 className="section-label mb-2">Verification</h3>
        <p className="text-[11.5px] leading-snug text-faint">
          The calculation engine is checked against published Ja&apos;fari
          timetables for Qom, Tehran, Najaf, Makkah, London and Vancouver, and
          against an independent solar-position source, to within two minutes.
        </p>
      </div>

      <p className="mt-4 text-[11px] text-faint/70">Version {version}</p>
    </Card>
  );
}
