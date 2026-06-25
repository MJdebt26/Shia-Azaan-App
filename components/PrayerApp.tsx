"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TopBar } from "./TopBar";
import { DateLine } from "./DateLine";
import { SkyHero } from "./SkyHero";
import { PrayerList } from "./PrayerList";
import { SubTimes } from "./SubTimes";
import { QiblaCard } from "./QiblaCard";
import { ReciterPlayer } from "./ReciterPlayer";
import { SettingsCard } from "./SettingsCard";
import { LocationSheet } from "./LocationSheet";
import { AlertBanner } from "./AlertBanner";
import { Footnote } from "./Footnote";

import { useClock } from "@/hooks/useClock";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

import { compute, qibla } from "@/lib/prayer";
import { currentPrayerIndex, nextPrayer } from "@/lib/derive";
import { ALERT_PRAYERS } from "@/lib/constants";
import { DEFAULT_CITY, type City } from "@/lib/cities";
import { RECITERS } from "@/lib/reciters";
import { store } from "@/lib/store";
import {
  clearScheduled,
  notifyNow,
  permission,
  requestPermission,
  scheduleUpcoming,
} from "@/lib/notifications";
import {
  dayKeyOf,
  fmtSpan,
  fmtTime,
  gregString,
  hijriString,
  localDateObj,
  localNowHours,
  tzOffset,
} from "@/lib/time";
import { greeting, skyColors, skyPhase, starsVisible } from "@/lib/sky";
import type { Loc, MethodKey, PrayerMeta } from "@/lib/types";

export default function PrayerApp() {
  const now = useClock(1000);

  // --- persisted state ---
  const [mounted, setMounted] = useState(false);
  const [loc, setLocState] = useState<Loc | null>(null);
  const [method, setMethodState] = useState<MethodKey>("leva");
  const [fmt24, setFmt24State] = useState(false);
  const [alertsOn, setAlertsOnState] = useState(false);
  const [adhanUrl, setAdhanUrlState] = useState("");
  const [reciter, setReciterState] = useState(RECITERS[0].edition);

  // --- transient UI state ---
  const [sheetOpen, setSheetOpen] = useState(false);
  const [banner, setBanner] = useState<{ show: boolean; title: string }>({
    show: false,
    title: "",
  });

  const player = useAudioPlayer();
  const geo = useGeolocation();
  const orient = useDeviceOrientation();
  const install = useInstallPrompt();

  const lastAlerted = useRef<string | null>(null);

  // --- hydrate from storage + register the service worker (once) ---
  useEffect(() => {
    const m = store.get("method");
    if (m === "leva" || m === "tehran") setMethodState(m);
    setFmt24State(store.get("fmt") === "24");
    setAlertsOnState(store.get("alerts") === "1");
    const au = store.get("adhanUrl");
    if (au) setAdhanUrlState(au);
    const rc = store.get("reciter");
    if (rc) setReciterState(rc);

    const saved = store.get("loc");
    if (saved) {
      try {
        setLocState(JSON.parse(saved) as Loc);
      } catch {
        setLocState(DEFAULT_CITY);
      }
    } else {
      setLocState(DEFAULT_CITY);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setMounted(true);
  }, []);

  // --- core derivation ---
  const dateObj = localDateObj(loc, now);
  const nowH = localNowHours(loc, now);
  const dayKey = dayKeyOf(dateObj);

  const off = useMemo(() => {
    if (!loc) return 0;
    const [y, m, d] = dayKey.split("-").map(Number);
    return tzOffset(loc.tz, new Date(y, m - 1, d));
  }, [loc, dayKey]);

  const times = useMemo(() => {
    if (!loc) return null;
    const [y, m, d] = dayKey.split("-").map(Number);
    return compute(new Date(y, m - 1, d), loc.lat, loc.lng, off, method);
  }, [loc, method, dayKey, off]);

  // --- in-app prayer alert (banner + sound + notification) ---
  useEffect(() => {
    if (!mounted || !loc || !times || !alertsOn) return;
    const nH = localNowHours(loc, now);
    for (const p of ALERT_PRAYERS) {
      const diff = (nH - times[p.key]) * 60;
      if (diff >= 0 && diff < 1) {
        const stamp = localDateObj(loc, now).toDateString() + p.key;
        if (lastAlerted.current !== stamp) {
          lastAlerted.current = stamp;
          setBanner({ show: true, title: `${p.en} · ${p.ar}` });
          window.setTimeout(() => setBanner((b) => ({ ...b, show: false })), 9000);
          notifyNow(`${p.en} — time to pray`, loc.name);
          const url = adhanUrl.trim();
          if (url) player.playRaw(url, "Adhan", p.en);
          else player.playPiece(reciter, "kursi");
        }
      }
    }
  }, [now, mounted, loc, times, alertsOn, adhanUrl, reciter, player]);

  // --- schedule background notifications for the day ---
  useEffect(() => {
    if (!mounted) return;
    if (!alertsOn || !loc || !times) {
      clearScheduled();
      return;
    }
    if (permission() === "granted") scheduleUpcoming(times, loc, new Date());
  }, [mounted, alertsOn, loc, times]);

  // --- persisted setters (write-through) ---
  const setLoc = (next: Loc) => {
    setLocState(next);
    store.set("loc", JSON.stringify(next));
    setSheetOpen(false);
  };
  const setMethod = (m: MethodKey) => {
    setMethodState(m);
    store.set("method", m);
  };
  const setFmt = (v: boolean) => {
    setFmt24State(v);
    store.set("fmt", v ? "24" : "12");
  };
  const setAdhanUrl = (v: string) => {
    setAdhanUrlState(v);
    store.set("adhanUrl", v);
  };
  const setReciter = (ed: string) => {
    setReciterState(ed);
    store.set("reciter", ed);
    if (player.activePiece) player.playPiece(ed, player.activePiece);
  };
  const toggleAlerts = async () => {
    const v = !alertsOn;
    setAlertsOnState(v);
    store.set("alerts", v ? "1" : "0");
    if (v) {
      const perm = await requestPermission();
      if (perm === "granted" && loc && times) scheduleUpcoming(times, loc, new Date());
    } else {
      clearScheduled();
    }
  };

  // --- boot frame ---
  if (!mounted || !loc || !times) {
    return (
      <main className="wrap">
        <div className="boot">Loading prayer times…</div>
      </main>
    );
  }

  // --- presentational derivations ---
  const currentIndex = currentPrayerIndex(nowH, times);
  const next = nextPrayer(nowH, times);
  const nextLabel = currentIndex === -1 ? "Next · Fajr begins" : "Next prayer";
  const phase = skyPhase(nowH, times);

  return (
    <main className="wrap">
      <TopBar
        greeting={greeting(nowH, times)}
        locName={loc.name}
        onOpenLocation={() => setSheetOpen(true)}
      />
      <DateLine greg={gregString(dateObj)} hijri={hijriString(dateObj)} />

      <SkyHero
        skyColors={skyColors(phase)}
        starsOn={starsVisible(phase)}
        nextLabel={nextLabel}
        nextMeta={next.meta as PrayerMeta}
        nextTime={fmtTime(next.hour % 24, fmt24)}
        countdown={fmtSpan((next.hour - nowH) * 60)}
        lat={loc.lat}
        lng={loc.lng}
        off={off}
        dayKey={dayKey}
        times={times}
        currentIndex={currentIndex}
        nowH={nowH}
      />

      <PrayerList times={times} currentIndex={currentIndex} fmt24={fmt24} />
      <SubTimes times={times} fmt24={fmt24} />

      <div className="grid2">
        <QiblaCard
          bearing={qibla(loc.lat, loc.lng)}
          heading={orient.heading}
          needsPermission={orient.needsPermission}
          onEnable={orient.enable}
        />
        <ReciterPlayer edition={reciter} onChangeReciter={setReciter} player={player} />
      </div>

      <SettingsCard
        method={method}
        onMethod={setMethod}
        fmt24={fmt24}
        onFmt={setFmt}
        alertsOn={alertsOn}
        onToggleAlerts={toggleAlerts}
        adhanUrl={adhanUrl}
        onAdhanUrl={setAdhanUrl}
        canInstall={install.canInstall}
        isIOS={install.isIOS}
        installed={install.installed}
        onInstall={install.promptInstall}
      />

      <Footnote />

      <LocationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        locating={geo.locating}
        gpsError={geo.error}
        onUseGPS={() => geo.request((l) => setLoc(l))}
        onSelectCity={(c: City) => setLoc(c)}
      />

      <AlertBanner show={banner.show} title={banner.title} />
    </main>
  );
}
