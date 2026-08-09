# Awqāt — Shia Prayer Times (v2)

Ja'fari (Shia) prayer times computed **on your device** for your exact
coordinates — no prayer-time API, works fully offline. A **living sky** that
tracks the real sun *and the real weather where you are*, a Qibla compass with a
live heading, a **built-in adhan library** you pick from inside the app, and
prayer notifications that **actually arrive** — including when the app is closed.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind**.
Fonts and audio are self-hosted. Two features reach the network, both optional
and both off-by-default-able: background push, and live weather (see
[Privacy](#privacy)).

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + tests
```

---

## What changed from v1, and why

v1 looked polished but three things did not actually work. v2 fixes the causes,
not the symptoms.

| Problem in v1 | Root cause | Fix in v2 |
| --- | --- | --- |
| **Notifications never fired when the app was closed** | It used the Notification Triggers API (`TimestampTrigger`), which Google **never shipped** — the origin trial ended at Chrome 88 and it was abandoned. The calls succeeded silently and nothing ever fired. | Real **Web Push** (`app/api/push/*` + a per-minute Vercel Cron) plus a precise **foreground scheduler**. A **capabilities probe** tells you honestly what your device can and cannot do — no more silent failure. |
| **You had to paste an .mp3 URL to get an adhan** | No audio ever shipped with the app. | A **built-in adhan picker**: two bundled, licensed recordings and three on-device synthesised tones, each auditioned before you choose. A custom URL survives only as an advanced escape hatch. |
| **A custom adhan often played nothing** | Cross-origin audio + the browser autoplay policy, with errors swallowed. | One `AudioEngine` with an explicit **gesture-unlock** step (the same tap that grants notification permission) and typed, surfaced errors. |

Beyond those: a full visual redesign with a real light theme, eight calculation
methods, selectable high-latitude rules, per-prayer manual adjustments, a
polar-day fallback, and a rebuilt, timezone-correct engine covered by **134
tests**.

---

## The living sky

The hero — and, more faintly, the whole page — is coloured by two independent
inputs.

**The sun** decides the hue. Eight solar phases (night → predawn → dawn →
morning → midday → afternoon → dusk → evening) are derived from *your computed
prayer times*, not from clock hours, so the colour is right in Reykjavík in June
and in Najaf in December alike.

**The weather** decides how much of that hue survives. Rather than a second
palette fighting the first, conditions desaturate and darken the solar colours
toward a neutral grey — an overcast afternoon is the same sun seen through
cloud. On top of that:

| Conditions | What you see |
| --- | --- |
| Clear | Untouched solar gradient, full star field at night |
| Partly cloudy / overcast | Drifting cloud bands, sky greyed in proportion to the reported cover, stars fading out |
| Fog | Soft fog banks breathing in and out |
| Drizzle / rain / sleet | Canvas rain streaks drawn along their true velocity vector, so they lean into the real wind speed |
| Snow | Slower flakes with a sine sway |
| Hail | Fast, round, bright particles |
| Thunderstorm | Heaviest rain plus irregular double-flash lightning |

The particle field is a single canvas (a heavy field is ~260 particles; that is
trivial for one canvas and ruinous for 260 divs). It stops completely when the
tab is hidden or the hero scrolls out of view, paints one still frame under
`prefers-reduced-motion`, and scales its count to the element's area. The motion
itself lives in `lib/weather/particles.ts` as pure functions so it is unit-tested
rather than eyeballed.

---

## Privacy

Prayer times, the Qibla, the sun path and every adhan are computed or bundled
locally; the app is fully usable with the network off. Exactly two things leave
the device, and neither is required:

- **Live weather** — your coordinates are **rounded to two decimals (~1.1 km)**
  before being sent to [Open-Meteo](https://open-meteo.com) (no API key, no
  account). Weather does not vary meaningfully below that, so your exact
  location is never transmitted. Toggle it off in **Settings → General → Live
  weather** and no request is ever made.
- **Background push** — only if you enable it, and only your subscription plus
  the settings needed to time the alerts.

---

## Accuracy

The engine (`lib/prayer/`) is a pure port of the low-precision solar model from
the *Astronomical Almanac*. It is checked in CI against the Aladhan reference
implementation (method 0, "Shia Ithna-Ashari, Leva Institute, Qom", with the
Ja'fari midnight mode) and against an independent solar-position source, for
Qom, Tehran, Najaf, Makkah, London and Vancouver across the seasons — agreement
is within two minutes everywhere. Reproduce any golden value with the `curl`
command quoted in `tests/prayer.test.ts`.

The Shia rulings the tests pin down: **Maghrib** at a depression angle (not at
sunset), **Islamic midnight** as the midpoint of sunset → the following Fajr,
and **Imsāk** a configurable number of minutes before Fajr.

---

## Layout

```
app/
  layout.tsx            metadata, viewport, theme bootstrap, self-hosted fonts
  page.tsx              renders <AwqatApp/>
  globals.css           design tokens + component layer (light & dark)
  api/push/*            subscribe · unsubscribe · public-key   (Web Push)
  api/cron/dispatch     per-minute push dispatcher (VAPID, de-duplicated)
components/
  AwqatApp.tsx          client orchestrator: derives "now", drives the live sky
  today/                Hero · SunArc · PrayerTable
  weather/              WeatherLayer · Precipitation (canvas) · WeatherBadge
  qibla/QiblaView.tsx   compass with live heading + honest fallbacks
  settings/             AlertsCard · CalculationCard · GeneralCard · AboutCard · AdhanPicker
  ui/                   Sheet (focus-trapped) · Controls · Icon
lib/
  prayer/               astronomy · methods · times · qibla · schedule   (pure)
  weather/              codes (WMO) · client (Open-Meteo) · tint · particles · units
  audio/                catalog · synth (Web Audio) · player (AudioEngine)
  notifications/        capabilities · permission · scheduler · subscribe
  push/                 vapid · store (Upstash or in-memory) · payload
  time.ts               formatToParts-based, DST-correct tz helpers
  cities.ts settings.ts store.ts sky.ts constants.ts types.ts
hooks/
  useNow · useSettings · useGeolocation · useCompass · useInstallPrompt
  useAdhanPlayer · useWeather
tests/                  prayer · time · schedule · weather · particles
                        (Vitest, 134 tests)
```

---

## Notifications: the honest version

There are two delivery paths and the app tells you which one your device
supports (`lib/notifications/capabilities.ts`):

1. **App open / backgrounded** — a foreground scheduler arms a single timer for
   the next alert, shows a banner, plays the chosen adhan and posts a system
   notification. Works everywhere.
2. **App fully closed** — real **Web Push**. Works on Chromium, Firefox, and on
   **iOS 16.4+ only once the PWA is installed to the Home Screen** — which the
   app states plainly instead of failing silently.

### Enabling background push

```bash
npm run vapid -- mailto:you@example.com   # prints keys for .env.local
```

Then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and `CRON_SECRET` (see `.env.example`). For
production, add an Upstash Redis (`UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`) so subscriptions survive serverless cold starts —
without it the store falls back to memory and says so, loudly, in the logs.

### Driving the dispatcher

`/api/cron/dispatch` has to be called regularly for alerts to go out while the
app is closed. It is authenticated with `CRON_SECRET` and is **idempotent** — it
de-duplicates per prayer per day — so it is safe to call from more than one
scheduler.

**Vercel's own cron will not do this on the free plan.** Hobby accounts reject
any expression that runs more than once a day; `* * * * *` fails the deployment
outright, and even a permitted daily job has ±59 minutes of slop. `vercel.json`
therefore ships with no cron. Pick a driver:

| Driver | Cost | Precision | Setup |
| --- | --- | --- | --- |
| **GitHub Actions** (included, `.github/workflows/prayer-dispatch.yml`) | Free | ~5 min, best-effort | Add `APP_URL` and `CRON_SECRET` repo secrets |
| **cron-job.org** or similar | Free | 1 min | Point it at the endpoint with the `Authorization` header |
| **Vercel Cron** | Pro ($20/mo) | 1 min | Add `crons` back to `vercel.json` with `* * * * *` |

To re-enable the native Vercel cron on Pro:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/dispatch", "schedule": "* * * * *" }]
}
```

---

## Audio credits

- **Adhan — Sabah Fakhri** — public domain, via Wikimedia Commons.
- **Adhan — Aaqib Azeez** — CC BY-SA 4.0, via Wikimedia Commons.
- Chime / Bell / Takbīr tones are synthesised on the device with the Web Audio
  API (zero bytes, always offline).

Weather data from [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Reverse
geocoding uses BigDataCloud's key-less client endpoint, and falls back to the
nearest known city offline. Verify the first day of a new Hijri month with your
local community.
