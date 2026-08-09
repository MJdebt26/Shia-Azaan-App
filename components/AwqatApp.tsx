"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Footnote, Header, TabBar, type TabId } from "./Chrome";
import { LocationSheet } from "./LocationSheet";
import { TodayView } from "./today/TodayView";
import { QiblaView } from "./qibla/QiblaView";
import { AlertsCard } from "./settings/AlertsCard";
import { CalculationCard } from "./settings/CalculationCard";
import { GeneralCard } from "./settings/GeneralCard";
import { AboutCard } from "./settings/AboutCard";
import { AlertBanner } from "./AlertBanner";

import { useNow } from "@/hooks/useNow";
import { useSettings } from "@/hooks/useSettings";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCompass } from "@/hooks/useCompass";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useAdhanPlayer } from "@/hooks/useAdhanPlayer";
import { useWeather } from "@/hooks/useWeather";
import { tintSky } from "@/lib/weather/tint";
import { prefersCelsius } from "@/lib/weather/units";

import { timesForDay, nextPrayerAfter, currentPrayerAt } from "@/lib/prayer/schedule";
import { isPolarDay } from "@/lib/prayer/times";
import {
  dateFromKey,
  dayKey as dayKeyFor,
  gregorianLabel,
  hijriLabel,
  localHours,
  tzOffsetHours,
} from "@/lib/time";
import { greeting, skyColors, skyPhase } from "@/lib/sky";
import { getAdhanOption } from "@/lib/audio/catalog";
import { PRAYER_BY_KEY } from "@/lib/constants";
import {
  detectCapabilities,
  type NotificationCapabilities,
} from "@/lib/notifications/capabilities";
import {
  requestPermission,
  showLocalNotification,
} from "@/lib/notifications/permission";
import { createAlertScheduler } from "@/lib/notifications/scheduler";
import {
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications/subscribe";
import type { AlertJob } from "@/lib/prayer/schedule";
import type { AlertableKey, PrayerKey } from "@/lib/types";

const APP_VERSION = "2.0.0";

/**
 * The application shell.
 *
 * Owns three things and delegates everything else: which tab is showing, the
 * derived view of "now", and the wiring between the alert scheduler, the audio
 * engine and the notification layer.
 */
export default function AwqatApp() {
  const now = useNow(1000);
  const settings = useSettings();
  const geo = useGeolocation();
  const compass = useCompass();
  const install = useInstallPrompt();
  const player = useAdhanPlayer();

  const [tab, setTab] = useState<TabId>("today");

  // Honour the manifest shortcut (`/?tab=qibla`) on first load. This reads the
  // URL — an external system — after hydration on purpose: the page is
  // statically prerendered as "today", so switching any earlier would cause a
  // hydration mismatch.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    if (requested === "qibla" || requested === "settings") setTab(requested);
  }, []);
  const [locationOpen, setLocationOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<NotificationCapabilities>(
    () => detectCapabilities(),
  );
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(
    null,
  );

  const {
    loc, calc, alerts, timeFormat, theme, hijriOffset, customAdhanUrl,
    weather: weatherEnabled, hydrated,
  } = settings;

  const weather = useWeather(loc?.lat ?? null, loc?.lng ?? null, weatherEnabled);

  // Inferred from the browser locale rather than asked for. Computed once —
  // the locale does not change mid-session.
  const useCelsius = useMemo(() => prefersCelsius(), []);

  // --- register the service worker once -----------------------------------
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional; never block the app on it */
    });
  }, []);

  useEffect(() => {
    void isSubscribed().then(setPushOn);
  }, []);

  // --- theme --------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "dark" : "light");
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, hydrated]);

  // --- derived view of "now" ----------------------------------------------
  const view = useMemo(() => {
    if (!loc) return null;
    const key = dayKeyFor(loc.tz, now);
    const times = timesForDay(loc, calc, key);
    const nowH = localHours(loc.tz, now);
    const next = nextPrayerAfter(loc, calc, now);
    const current = currentPrayerAt(loc, calc, now);
    const tzOffset = tzOffsetHours(loc.tz, dateFromKey(key));

    const prevMs = current ? current.at.getTime() : next.at.getTime() - 6 * 3_600_000;
    const span = next.at.getTime() - prevMs;
    const progress =
      span > 0 ? Math.min(1, Math.max(0, (now.getTime() - prevMs) / span)) : 0;

    const polar = isPolarDay({
      date: dateFromKey(key),
      lat: loc.lat,
      lng: loc.lng,
      tzOffset,
      elevation: loc.elevation,
    });

    return {
      key,
      times,
      nowH,
      tzOffset,
      next,
      current,
      progress,
      minutesUntil: (next.at.getTime() - now.getTime()) / 60000,
      phase: skyPhase(nowH, times),
      polarWarning: polar
        ? "The sun does not rise or set at your location today, so Fajr, Maghrib and Isha are estimated from the nearest latitude with a normal day. Follow your community's ruling."
        : null,
    };
  }, [loc, calc, now]);

  // --- push the live sky onto the whole document --------------------------
  // The hero owns its own gradient, but these variables also drive the
  // page-wide ambient wash and the browser chrome, so the entire app shifts
  // colour as the sun moves and as the weather changes.
  const phase = view?.phase;
  const skyStops = useMemo(() => {
    if (!phase) return null;
    const base = skyColors(phase);
    return weather.data ? tintSky(base, weather.data.kind, phase) : base;
  }, [phase, weather.data]);

  useEffect(() => {
    if (!skyStops) return;
    const root = document.documentElement;
    root.style.setProperty("--sky-1", skyStops[0]);
    root.style.setProperty("--sky-2", skyStops[1]);
    root.style.setProperty("--sky-3", skyStops[2]);

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]:not([media])',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", skyStops[0]);
  }, [skyStops]);

  // --- fire an alert ------------------------------------------------------
  const fireAlert = useCallback(
    (job: AlertJob) => {
      const meta = PRAYER_BY_KEY[job.key as PrayerKey];
      const setting = alerts[job.key];
      const title = `${meta.en} — time to pray`;
      const body = loc ? `${meta.ar} · ${loc.name}` : meta.ar;

      setBanner({ title: `${meta.en} · ${meta.ar}`, body: "It is time to pray" });
      window.setTimeout(() => setBanner(null), 12000);

      void showLocalNotification(title, { body, tag: `awqat-${job.dedupeKey}` });

      if (setting?.mode === "sound") {
        const option = getAdhanOption(job.soundId, customAdhanUrl);
        void player.play(option);
      }
    },
    [alerts, loc, player, customAdhanUrl],
  );

  // Keep the scheduler reading the freshest settings without re-arming on
  // every tick: its getters read this ref rather than closing over render
  // values. Written in an effect, never during render.
  const latest = useRef({ loc, calc, alerts, fireAlert });
  useEffect(() => {
    latest.current = { loc, calc, alerts, fireAlert };
  }, [loc, calc, alerts, fireAlert]);

  const schedulerRef = useRef<ReturnType<typeof createAlertScheduler> | null>(
    null,
  );

  useEffect(() => {
    if (!hydrated) return;
    const scheduler = createAlertScheduler({
      getLoc: () => latest.current.loc,
      getCalc: () => latest.current.calc,
      getAlerts: () => latest.current.alerts,
      onFire: (job) => latest.current.fireAlert(job),
    });
    schedulerRef.current = scheduler;
    scheduler.start();
    return () => {
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, [hydrated]);

  // Re-arm whenever something that moves a prayer instant changes. Serialised
  // to a string so a new-but-equal settings object does not churn the timer.
  const schedulerKey = JSON.stringify([
    loc?.lat, loc?.lng, loc?.tz, calc, alerts,
  ]);
  useEffect(() => {
    schedulerRef.current?.refresh();
  }, [schedulerKey]);

  // Keep the server's copy of the settings current while push is on.
  useEffect(() => {
    if (!hydrated || !pushOn || !loc) return;
    const id = window.setTimeout(() => {
      void subscribeToPush(loc, calc, alerts);
    }, 600);
    return () => window.clearTimeout(id);
  }, [hydrated, pushOn, loc, calc, alerts]);

  // --- actions ------------------------------------------------------------
  const handleRequestPermission = useCallback(async () => {
    setPermissionBusy(true);
    // The same gesture unlocks audio, which is why alerts now make sound.
    void player.unlock();
    await requestPermission();
    setCapabilities(detectCapabilities());
    setPermissionBusy(false);
  }, [player]);

  const handleTogglePush = useCallback(
    async (on: boolean) => {
      if (!loc) return;
      if (on) {
        const result = await subscribeToPush(loc, calc, alerts);
        setPushOn(result.ok);
      } else {
        await unsubscribeFromPush();
        setPushOn(false);
      }
      setCapabilities(detectCapabilities());
    },
    [loc, calc, alerts],
  );

  const handleTestNotification = useCallback(() => {
    void player.unlock();
    void showLocalNotification("Awqāt — test alert", {
      body: "If you can see this, notifications are working.",
      tag: "awqat-test",
    });
    setBanner({ title: "Test alert", body: "This is what a prayer alert looks like." });
    window.setTimeout(() => setBanner(null), 6000);
  }, [player]);

  // --- boot ---------------------------------------------------------------
  if (!hydrated || !loc || !view) {
    return (
      <main className="mx-auto grid min-h-[70dvh] max-w-app place-items-center px-4">
        <p className="text-[13px] tracking-wide text-faint">Loading prayer times…</p>
      </main>
    );
  }

  const alertsEnabled = capabilities.permission === "granted";
  const highLatRelevant = Math.abs(loc.lat) >= 45;

  return (
    <>
      {/* The page-wide colour wash that follows the sun and the weather. */}
      <div className="sky-ambient" aria-hidden="true" />

      <main className="relative z-10 mx-auto max-w-app px-4 pb-24 pt-5 sm:pt-7">
        <Header
          greeting={greeting(view.nowH, view.times)}
          locationName={loc.name}
          gregorian={gregorianLabel(view.key)}
          hijri={hijriLabel(view.key, hijriOffset)}
          onOpenLocation={() => setLocationOpen(true)}
        />

        {tab === "today" && (
          <div className="fade-up">
            <TodayView
              phase={view.phase}
              times={view.times}
              nowHours={view.nowH}
              currentKey={(view.current?.key as PrayerKey) ?? null}
              nextKey={view.next.key as PrayerKey}
              nextAt={view.next.at}
              nextHours={view.next.hours}
              minutesUntil={view.minutesUntil}
              progress={view.progress}
              isFirstOfDay={view.current === null}
              timeFormat={timeFormat}
              alerts={alerts}
              alertsEnabled={alertsEnabled}
              lat={loc.lat}
              lng={loc.lng}
              tzOffset={view.tzOffset}
              dayKey={view.key}
              polarWarning={view.polarWarning}
              weather={weather.data}
              useCelsius={useCelsius}
            />
          </div>
        )}

        {tab === "qibla" && (
          <div className="fade-up">
            <QiblaView
              loc={loc}
              heading={compass.heading}
              supported={compass.supported}
              needsPermission={compass.needsPermission}
              error={compass.error}
              onEnable={compass.enable}
            />
          </div>
        )}

        {tab === "settings" && (
          <div className="fade-up space-y-3.5">
            <AlertsCard
              alerts={alerts}
              onChange={(key: AlertableKey, next) =>
                settings.setAlerts({ ...alerts, [key]: next })
              }
              capabilities={capabilities}
              onRequestPermission={handleRequestPermission}
              busy={permissionBusy}
              pushEnabled={pushOn}
              onTogglePush={(on) => void handleTogglePush(on)}
              customUrl={customAdhanUrl}
              onCustomUrl={settings.setCustomAdhanUrl}
              player={player}
              onTestNotification={handleTestNotification}
            />
            <CalculationCard
              calc={calc}
              onChange={settings.setCalc}
              highLatRelevant={highLatRelevant}
            />
            <GeneralCard
              timeFormat={timeFormat}
              onTimeFormat={settings.setTimeFormat}
              theme={theme}
              onTheme={settings.setTheme}
              weather={weatherEnabled}
              onWeather={settings.setWeather}
              weatherError={weather.error}
              weatherLabel={weather.data?.label ?? null}
              hijriOffset={hijriOffset}
              onHijriOffset={settings.setHijriOffset}
              todayKey={view.key}
              canInstall={install.canInstall}
              isIOS={install.isIOS}
              installed={install.isStandalone || install.justInstalled}
              onInstall={install.promptInstall}
            />
            <AboutCard version={APP_VERSION} />
          </div>
        )}

        <Footnote />
      </main>

      <TabBar active={tab} onChange={setTab} />

      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        current={loc}
        onSelect={settings.setLoc}
        locating={geo.locating}
        error={geo.error}
        onUseGPS={() => geo.request(settings.setLoc)}
      />

      <AlertBanner banner={banner} onDismiss={() => setBanner(null)} />
    </>
  );
}
