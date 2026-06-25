# Awqāt — Shia Prayer Times (Next.js PWA)

Ja'fari (Shia) prayer times computed **locally** for the user's exact
coordinates — no prayer-time API. A living-sky hero with a sun-path arc, a
Qibla compass with live heading, Qur'an reciters, and prayer alerts. Installs
to the home screen and works offline.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind**. Fonts are
self-hosted (no Google Fonts CDN), so the UI renders offline once installed.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

## Deploy to Vercel

Push to a Git repo and import it at vercel.com, or:

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

No environment variables are required. The service worker and manifest are
plain files in `public/`, so they ship as-is.

> HTTPS is required for geolocation, the service worker, and install prompts.
> `localhost` counts as secure for dev; Vercel gives you HTTPS in production.

---

## How it's built

```
app/
  layout.tsx        metadata, viewport, self-hosted fonts, <html>/<body>
  page.tsx          renders <PrayerApp/>
  globals.css       full design system (CSS variables + component classes)
components/
  PrayerApp.tsx     client orchestrator: state, derivation, effects, layout
  SkyHero.tsx       living-sky gradient + sun-path arc (the signature piece)
  PrayerList.tsx · SubTimes.tsx · QiblaCard.tsx · ReciterPlayer.tsx
  SettingsCard.tsx · LocationSheet.tsx · AlertBanner.tsx · TopBar.tsx · ...
lib/
  prayer.ts         validated Ja'fari astronomy engine (compute/altitude/qibla)
  cities.ts         city list with IANA timezones
  reciters.ts       reciters + Islamic Network audio URLs
  time.ts           timezone + formatting + Hijri date helpers
  sky.ts            solar-phase → palette
  notifications.ts  permission + background scheduling
  derive.ts         current-prayer / next-prayer helpers
  store.ts          sandbox-safe localStorage
hooks/
  useClock · useGeolocation · useDeviceOrientation · useInstallPrompt · useAudioPlayer
public/
  manifest.webmanifest · sw.js · icons/
```

The astronomy is ported verbatim from the validated reference implementation
and checked against published times for Mecca, Najaf, Tehran, London and
Vancouver across summer and winter. Two methods ship: **Qom** (Leva Institute —
Fajr 16°, Isha 14°, Maghrib 4° below the horizon) and **Tehran** (Institute of
Geophysics). Imsak = Fajr − 10 min; Islamic Midnight = midpoint of sunset →
next Fajr; a half-night fallback keeps high latitudes sane.

---

## PWA: install & offline

- **Install** — Chrome/Edge/Android show an install button in Settings (and a
  browser prompt). iOS Safari: Share → *Add to Home Screen*.
- **Offline** — `sw.js` caches the app shell + Next chunks + fonts + icons. The
  prayer math runs entirely client-side, so **times work with no connection**.
  Only recitation audio and the GPS city-name lookup need the network.

## Prayer notifications — read this

There are two delivery paths, and the difference matters:

1. **App open / backgrounded** — when a prayer time arrives, the running app
   shows an in-app banner, plays the adhan (or the selected reciter's Ayat
   al-Kursi), and posts a system notification. This always works.

2. **App fully closed** — handled by pre-scheduling with the **Notification
   Triggers API** (`TimestampTrigger`). The OS fires the notification without
   the page running. This works on **Chromium-based browsers, including
   installed Android PWAs**. Where it's unavailable — **notably iOS Safari** —
   the app degrades gracefully (no error), but a notification will not fire
   while the app is closed.

### Making closed-app delivery reliable everywhere (Web Push)

The proper cross-platform fix (and the natural next step) is **Web Push**, which
*does* work on iOS 16.4+ for installed PWAs:

1. Generate VAPID keys (`npx web-push generate-vapid-keys`).
2. Add a Vercel serverless route (e.g. `app/api/push/route.ts`) to store
   `PushSubscription`s and send pushes with the `web-push` package.
3. On the client, after notification permission is granted, call
   `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   and POST the subscription to your route.
4. Schedule the sends — a Vercel Cron job that, each minute, pushes to any
   subscriber whose next prayer is due. Because times are deterministic from
   `lib/prayer.ts`, the server can compute them per-subscriber from stored
   coordinates.

`sw.js` already has the `notificationclick` handler that focuses/opens the app;
you'd add a `push` event handler that calls `showNotification`.

---

## Customizing

- **Calculation methods** — `lib/prayer.ts` → `METHODS`. Add e.g. a different
  Marja' angle set, then add a button in `SettingsCard.tsx`.
- **Cities** — `lib/cities.ts`. Tuple is `[name, country, lat, lng, IANA tz]`.
- **Reciters** — `lib/reciters.ts`. Editions are Islamic Network identifiers.
- **Default adhan** — Settings lets the user paste an `.mp3` URL. To bundle a
  default, drop a file in `public/` and use it as the fallback in
  `PrayerApp.tsx`'s alert effect instead of Ayat al-Kursi.
- **Icons** — regenerate with `python3 gen_icons.py` (Pillow) after editing the
  motif, or replace the PNGs in `public/icons/` directly.

## Credits

- Recitation audio: **Islamic Network** (`cdn.islamic.network`).
- Reverse geocoding: **BigDataCloud** client endpoint (no key).
- Prayer-time algorithm follows the standard PrayTimes approach with the
  Ja'fari (Shia) ruling for Maghrib and Midnight.

Verify the first days of each Hijri month with your local community.
