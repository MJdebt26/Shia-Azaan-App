import type { Loc } from "@/lib/types";

/**
 * The built-in city list.
 *
 * The app has to work with no network — a timetable that needs a geocoding API
 * to tell you where you are is a timetable that fails on a plane, in a basement
 * mosque, or on a pay-as-you-go SIM abroad. So the list ships in the bundle.
 * That forces a curation decision: it is weighted toward places with large Shia
 * communities (the ziyarat cities of Iraq and Iran first), then the Gulf, South
 * Asia, and the diaspora hubs of Europe, North America and Australia. Order
 * inside the array is meaningful: it breaks ties in search ranking, so the more
 * likely destination is listed first.
 *
 * Coordinates are city-centre; the prayer engine is insensitive to a few km
 * (a 10 km east-west shift moves the times by ~24 seconds).
 */

/** A city always knows its IANA zone, unlike a raw GPS fix. */
export interface City extends Loc {
  tz: string;
}

type CityTuple = [
  name: string,
  country: string,
  lat: number,
  lng: number,
  tz: string,
];

const RAW: CityTuple[] = [
  // --- Iraq: the ziyarat cities first ---------------------------------------
  ["Najaf", "Iraq", 32.0, 44.3333, "Asia/Baghdad"],
  ["Karbala", "Iraq", 32.616, 44.0242, "Asia/Baghdad"],
  ["Kadhimiya", "Iraq", 33.3789, 44.3378, "Asia/Baghdad"],
  ["Samarra", "Iraq", 34.1959, 43.8742, "Asia/Baghdad"],
  ["Baghdad", "Iraq", 33.3152, 44.3661, "Asia/Baghdad"],
  ["Kufa", "Iraq", 32.0289, 44.4009, "Asia/Baghdad"],
  ["Basra", "Iraq", 30.5085, 47.7804, "Asia/Baghdad"],
  ["Hillah", "Iraq", 32.4637, 44.4197, "Asia/Baghdad"],
  ["Nasiriyah", "Iraq", 31.0439, 46.2575, "Asia/Baghdad"],
  ["Amarah", "Iraq", 31.8356, 47.1447, "Asia/Baghdad"],
  ["Kut", "Iraq", 32.5126, 45.8181, "Asia/Baghdad"],
  ["Diwaniyah", "Iraq", 31.9928, 44.925, "Asia/Baghdad"],
  ["Mosul", "Iraq", 36.335, 43.1189, "Asia/Baghdad"],
  ["Erbil", "Iraq", 36.1901, 44.0091, "Asia/Baghdad"],

  // --- Iran -----------------------------------------------------------------
  ["Qom", "Iran", 34.6401, 50.8764, "Asia/Tehran"],
  ["Mashhad", "Iran", 36.2605, 59.6168, "Asia/Tehran"],
  ["Tehran", "Iran", 35.6892, 51.389, "Asia/Tehran"],
  ["Isfahan", "Iran", 32.6546, 51.668, "Asia/Tehran"],
  ["Shiraz", "Iran", 29.5918, 52.5837, "Asia/Tehran"],
  ["Tabriz", "Iran", 38.08, 46.2919, "Asia/Tehran"],
  ["Ahvaz", "Iran", 31.3183, 48.6706, "Asia/Tehran"],
  ["Karaj", "Iran", 35.8355, 50.9915, "Asia/Tehran"],
  ["Kermanshah", "Iran", 34.3142, 47.065, "Asia/Tehran"],
  ["Qazvin", "Iran", 36.2797, 50.0049, "Asia/Tehran"],
  ["Hamadan", "Iran", 34.7992, 48.5146, "Asia/Tehran"],
  ["Yazd", "Iran", 31.8974, 54.3569, "Asia/Tehran"],
  ["Kerman", "Iran", 30.2839, 57.0834, "Asia/Tehran"],
  ["Rasht", "Iran", 37.2808, 49.5832, "Asia/Tehran"],
  ["Zanjan", "Iran", 36.6736, 48.4787, "Asia/Tehran"],
  ["Urmia", "Iran", 37.5527, 45.0761, "Asia/Tehran"],
  ["Arak", "Iran", 34.0917, 49.6892, "Asia/Tehran"],
  ["Sari", "Iran", 36.5633, 53.0601, "Asia/Tehran"],
  ["Bandar Abbas", "Iran", 27.1832, 56.2666, "Asia/Tehran"],

  // --- Lebanon & Syria ------------------------------------------------------
  ["Beirut", "Lebanon", 33.8938, 35.5018, "Asia/Beirut"],
  ["Nabatieh", "Lebanon", 33.3789, 35.4839, "Asia/Beirut"],
  ["Tyre", "Lebanon", 33.2705, 35.2038, "Asia/Beirut"],
  ["Baalbek", "Lebanon", 34.0058, 36.2181, "Asia/Beirut"],
  ["Sidon", "Lebanon", 33.5571, 35.3729, "Asia/Beirut"],
  ["Sayyida Zaynab", "Syria", 33.4442, 36.3411, "Asia/Damascus"],
  ["Damascus", "Syria", 33.5138, 36.2765, "Asia/Damascus"],
  ["Aleppo", "Syria", 36.2021, 37.1343, "Asia/Damascus"],

  // --- Gulf -----------------------------------------------------------------
  ["Manama", "Bahrain", 26.2285, 50.586, "Asia/Bahrain"],
  ["Qatif", "Saudi Arabia", 26.5196, 49.9962, "Asia/Riyadh"],
  ["Dammam", "Saudi Arabia", 26.4207, 50.0888, "Asia/Riyadh"],
  ["Al Ahsa", "Saudi Arabia", 25.3487, 49.5856, "Asia/Riyadh"],
  ["Kuwait City", "Kuwait", 29.3759, 47.9774, "Asia/Kuwait"],
  ["Dubai", "UAE", 25.2048, 55.2708, "Asia/Dubai"],
  ["Abu Dhabi", "UAE", 24.4539, 54.3773, "Asia/Dubai"],
  ["Sharjah", "UAE", 25.3463, 55.4209, "Asia/Dubai"],
  ["Doha", "Qatar", 25.2854, 51.531, "Asia/Qatar"],
  ["Muscat", "Oman", 23.588, 58.3829, "Asia/Muscat"],
  ["Sanaa", "Yemen", 15.3694, 44.191, "Asia/Aden"],

  // --- Hijaz & the wider Middle East ---------------------------------------
  ["Makkah", "Saudi Arabia", 21.4225, 39.8262, "Asia/Riyadh"],
  ["Madinah", "Saudi Arabia", 24.5247, 39.5692, "Asia/Riyadh"],
  ["Jeddah", "Saudi Arabia", 21.4858, 39.1925, "Asia/Riyadh"],
  ["Riyadh", "Saudi Arabia", 24.7136, 46.6753, "Asia/Riyadh"],
  ["Amman", "Jordan", 31.9454, 35.9284, "Asia/Amman"],
  ["Cairo", "Egypt", 30.0444, 31.2357, "Africa/Cairo"],
  ["Istanbul", "Türkiye", 41.0082, 28.9784, "Europe/Istanbul"],
  ["Ankara", "Türkiye", 39.9334, 32.8597, "Europe/Istanbul"],

  // --- Caucasus & Central Asia ---------------------------------------------
  ["Baku", "Azerbaijan", 40.4093, 49.8671, "Asia/Baku"],
  ["Ganja", "Azerbaijan", 40.6828, 46.3606, "Asia/Baku"],

  // --- Afghanistan ----------------------------------------------------------
  ["Kabul", "Afghanistan", 34.5553, 69.2075, "Asia/Kabul"],
  ["Herat", "Afghanistan", 34.3529, 62.204, "Asia/Kabul"],
  ["Mazar-i-Sharif", "Afghanistan", 36.709, 67.1109, "Asia/Kabul"],
  ["Bamyan", "Afghanistan", 34.8214, 67.827, "Asia/Kabul"],

  // --- Pakistan -------------------------------------------------------------
  ["Karachi", "Pakistan", 24.8607, 67.0011, "Asia/Karachi"],
  ["Lahore", "Pakistan", 31.5204, 74.3587, "Asia/Karachi"],
  ["Islamabad", "Pakistan", 33.6844, 73.0479, "Asia/Karachi"],
  ["Quetta", "Pakistan", 30.1798, 66.975, "Asia/Karachi"],
  ["Gilgit", "Pakistan", 35.9208, 74.3082, "Asia/Karachi"],
  ["Skardu", "Pakistan", 35.2971, 75.6333, "Asia/Karachi"],

  // --- India & Bangladesh ---------------------------------------------------
  ["Lucknow", "India", 26.8467, 80.9462, "Asia/Kolkata"],
  ["Hyderabad", "India", 17.385, 78.4867, "Asia/Kolkata"],
  ["Mumbai", "India", 19.076, 72.8777, "Asia/Kolkata"],
  ["Delhi", "India", 28.6139, 77.209, "Asia/Kolkata"],
  ["Srinagar", "India", 34.0837, 74.7973, "Asia/Kolkata"],
  ["Bangalore", "India", 12.9716, 77.5946, "Asia/Kolkata"],
  ["Dhaka", "Bangladesh", 23.8103, 90.4125, "Asia/Dhaka"],

  // --- Britain & Europe -----------------------------------------------------
  ["London", "UK", 51.5074, -0.1278, "Europe/London"],
  ["Birmingham", "UK", 52.4862, -1.8904, "Europe/London"],
  ["Manchester", "UK", 53.4808, -2.2426, "Europe/London"],
  ["Paris", "France", 48.8566, 2.3522, "Europe/Paris"],
  ["Berlin", "Germany", 52.52, 13.405, "Europe/Berlin"],
  ["Hamburg", "Germany", 53.5511, 9.9937, "Europe/Berlin"],
  ["Stockholm", "Sweden", 59.3293, 18.0686, "Europe/Stockholm"],
  ["Malmo", "Sweden", 55.605, 13.0038, "Europe/Stockholm"],
  ["Gothenburg", "Sweden", 57.7089, 11.9746, "Europe/Stockholm"],
  ["Copenhagen", "Denmark", 55.6761, 12.5683, "Europe/Copenhagen"],
  ["Oslo", "Norway", 59.9139, 10.7522, "Europe/Oslo"],
  ["Amsterdam", "Netherlands", 52.3676, 4.9041, "Europe/Amsterdam"],
  ["The Hague", "Netherlands", 52.0705, 4.3007, "Europe/Amsterdam"],
  ["Brussels", "Belgium", 50.8503, 4.3517, "Europe/Brussels"],
  ["Vienna", "Austria", 48.2082, 16.3738, "Europe/Vienna"],
  ["Rome", "Italy", 41.9028, 12.4964, "Europe/Rome"],

  // --- Canada ---------------------------------------------------------------
  ["Toronto", "Canada", 43.6532, -79.3832, "America/Toronto"],
  ["Ottawa", "Canada", 45.4215, -75.6972, "America/Toronto"],
  ["Montreal", "Canada", 45.5017, -73.5673, "America/Toronto"],
  ["Vancouver", "Canada", 49.2827, -123.1207, "America/Vancouver"],
  ["Calgary", "Canada", 51.0447, -114.0719, "America/Edmonton"],
  ["Edmonton", "Canada", 53.5461, -113.4938, "America/Edmonton"],

  // --- United States --------------------------------------------------------
  ["Dearborn", "USA", 42.3223, -83.1763, "America/Detroit"],
  ["Detroit", "USA", 42.3314, -83.0458, "America/Detroit"],
  ["New York", "USA", 40.7128, -74.006, "America/New_York"],
  ["Chicago", "USA", 41.8781, -87.6298, "America/Chicago"],
  ["Houston", "USA", 29.7604, -95.3698, "America/Chicago"],
  ["Dallas", "USA", 32.7767, -96.797, "America/Chicago"],
  ["Los Angeles", "USA", 34.0522, -118.2437, "America/Los_Angeles"],
  ["San Francisco", "USA", 37.7749, -122.4194, "America/Los_Angeles"],
  ["Sacramento", "USA", 38.5816, -121.4944, "America/Los_Angeles"],
  ["Seattle", "USA", 47.6062, -122.3321, "America/Los_Angeles"],
  ["Phoenix", "USA", 33.4484, -112.074, "America/Phoenix"],
  ["Atlanta", "USA", 33.749, -84.388, "America/New_York"],
  ["Washington", "USA", 38.9072, -77.0369, "America/New_York"],
  ["Boston", "USA", 42.3601, -71.0589, "America/New_York"],

  // --- Australasia ----------------------------------------------------------
  ["Sydney", "Australia", -33.8688, 151.2093, "Australia/Sydney"],
  ["Melbourne", "Australia", -37.8136, 144.9631, "Australia/Melbourne"],
  ["Brisbane", "Australia", -27.4698, 153.0251, "Australia/Brisbane"],
  ["Perth", "Australia", -31.9505, 115.8605, "Australia/Perth"],
  ["Auckland", "New Zealand", -36.8485, 174.7633, "Pacific/Auckland"],

  // --- East Africa & Southeast Asia (Khoja and Hazara diaspora) -------------
  ["Dar es Salaam", "Tanzania", -6.7924, 39.2083, "Africa/Dar_es_Salaam"],
  ["Mombasa", "Kenya", -4.0435, 39.6682, "Africa/Nairobi"],
  ["Nairobi", "Kenya", -1.2921, 36.8219, "Africa/Nairobi"],
  ["Kano", "Nigeria", 12.0022, 8.592, "Africa/Lagos"],
  ["Kuala Lumpur", "Malaysia", 3.139, 101.6869, "Asia/Kuala_Lumpur"],
  ["Jakarta", "Indonesia", -6.2088, 106.8456, "Asia/Jakarta"],
];

export const CITIES: readonly City[] = RAW.map(
  ([name, country, lat, lng, tz]) => ({
    name,
    country,
    lat,
    lng,
    tz,
    source: "city" as const,
  }),
);

/**
 * Najaf is the default because it is the single most recognisable place for
 * this audience, and because a wrong-but-plausible default is worse than an
 * obviously-not-yours one: nobody in Vancouver mistakes Najaf's Fajr for their
 * own, so they set their real city on first launch.
 */
export const DEFAULT_CITY: City =
  CITIES.find((c) => c.name === "Najaf") ?? CITIES[0];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Normalise text for matching: strip diacritics, drop punctuation, lowercase.
 *
 * People type "Malmo" for Malmö, "Turkiye" for Türkiye and "Mazar i Sharif"
 * for Mazar-i-Sharif. Folding both sides of the comparison through the same
 * function makes all of those match without a fuzzy-matching library.
 */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Alternate spellings, transliterations and colloquial names.
 *
 * Keys are folded query fragments; values are the canonical city name they
 * should surface. This is where the transliteration problem lives: Arabic and
 * Persian place names have no single English spelling, so "Qum", "Ghom" and
 * "Qom" all have to find the same city.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  // Iraq
  "an najaf": "Najaf",
  najef: "Najaf",
  "najaf al ashraf": "Najaf",
  kerbala: "Karbala",
  kerbela: "Karbala",
  "karbala al muqaddasa": "Karbala",
  kadhimayn: "Kadhimiya",
  kazimayn: "Kadhimiya",
  kazimiyah: "Kadhimiya",
  kadhimiyah: "Kadhimiya",
  "al kadhimiya": "Kadhimiya",
  samara: "Samarra",
  "al kufa": "Kufa",
  basrah: "Basra",
  bassorah: "Basra",
  hilla: "Hillah",
  babylon: "Hillah",
  nasariyah: "Nasiriyah",
  "al amarah": "Amarah",
  "al kut": "Kut",
  "ad diwaniyah": "Diwaniyah",
  hawler: "Erbil",

  // Iran
  qum: "Qom",
  ghom: "Qom",
  ghum: "Qom",
  kum: "Qom",
  meshed: "Mashhad",
  mashad: "Mashhad",
  teheran: "Tehran",
  persia: "Tehran",
  esfahan: "Isfahan",
  ispahan: "Isfahan",
  sepahan: "Isfahan",
  tebriz: "Tabriz",
  ahwaz: "Ahvaz",
  karadj: "Karaj",
  bakhtaran: "Kermanshah",
  kazvin: "Qazvin",
  hamedan: "Hamadan",
  urumiyeh: "Urmia",
  orumiyeh: "Urmia",

  // Levant
  saida: "Sidon",
  sayda: "Sidon",
  sour: "Tyre",
  sur: "Tyre",
  nabatiyeh: "Nabatieh",
  "al nabatieh": "Nabatieh",
  baalbeck: "Baalbek",
  zaynab: "Sayyida Zaynab",
  zainab: "Sayyida Zaynab",
  zeinab: "Sayyida Zaynab",
  "sayyeda zeinab": "Sayyida Zaynab",
  dimashq: "Damascus",
  sham: "Damascus",
  halab: "Aleppo",

  // Gulf & Hijaz
  bahrain: "Manama",
  qateef: "Qatif",
  "al qatif": "Qatif",
  hofuf: "Al Ahsa",
  hasa: "Al Ahsa",
  "al hasa": "Al Ahsa",
  ahsa: "Al Ahsa",
  kuwait: "Kuwait City",
  qatar: "Doha",
  oman: "Muscat",
  yemen: "Sanaa",
  mecca: "Makkah",
  makka: "Makkah",
  mekka: "Makkah",
  bakkah: "Makkah",
  medina: "Madinah",
  medinah: "Madinah",
  madina: "Madinah",
  "al madinah": "Madinah",
  jiddah: "Jeddah",
  jedda: "Jeddah",

  // Türkiye, Caucasus, Afghanistan
  turkey: "Istanbul",
  turkiye: "Istanbul",
  constantinople: "Istanbul",
  stambul: "Istanbul",
  ganca: "Ganja",
  gyandzha: "Ganja",
  kabol: "Kabul",
  "mazar e sharif": "Mazar-i-Sharif",
  "mazar sharif": "Mazar-i-Sharif",
  mazar: "Mazar-i-Sharif",
  balkh: "Mazar-i-Sharif",
  bamiyan: "Bamyan",

  // South Asia
  kuetta: "Quetta",
  bombay: "Mumbai",
  bengaluru: "Bangalore",
  banglore: "Bangalore",
  kashmir: "Srinagar",
  "gilgit baltistan": "Gilgit",

  // Europe & North America
  england: "London",
  britain: "London",
  "united kingdom": "London",
  holland: "Amsterdam",
  netherlands: "Amsterdam",
  "den haag": "The Hague",
  goteborg: "Gothenburg",
  koebenhavn: "Copenhagen",
  wien: "Vienna",
  roma: "Rome",
  nyc: "New York",
  "new york city": "New York",
  manhattan: "New York",
  brooklyn: "New York",
  la: "Los Angeles",
  sf: "San Francisco",
  "bay area": "San Francisco",
  "silicon valley": "San Francisco",
  dc: "Washington",
  "washington dc": "Washington",
  michigan: "Dearborn",
  gta: "Toronto",
  mississauga: "Toronto",
  scarborough: "Toronto",

  // Africa & Southeast Asia
  dar: "Dar es Salaam",
  "dar es salam": "Dar es Salaam",
  tanzania: "Dar es Salaam",
  kenya: "Nairobi",
  nigeria: "Kano",
  kl: "Kuala Lumpur",
  malaysia: "Kuala Lumpur",
  indonesia: "Jakarta",
};

interface IndexedCity {
  city: City;
  /** Position in `CITIES` — the curated priority, used to break score ties. */
  order: number;
  name: string;
  country: string;
  /** Start offset of every word in `name`, for word-prefix matching. */
  wordStarts: number[];
}

const INDEX: IndexedCity[] = CITIES.map((city, order) => {
  const name = fold(city.name);
  const wordStarts: number[] = [];
  let at = 0;
  for (const word of name.split(" ")) {
    wordStarts.push(at);
    at += word.length + 1;
  }
  return { city, order, name, country: fold(city.country), wordStarts };
});

const FOLDED_ALIASES: ReadonlyArray<readonly [string, string]> = Object.entries(
  ALIASES,
).map(([alias, target]) => [fold(alias), fold(target)] as const);

/**
 * Match quality, lowest wins. The gap between name matches (0–2) and country
 * matches (3–4) is the ranking rule that matters: typing "ira" must surface
 * Iraqi and Iranian cities *after* any city whose own name starts with "ira",
 * and typing "man" must put Manama above every city in Germany.
 */
const SCORE_NAME_PREFIX = 0;
const SCORE_NAME_WORD = 1;
const SCORE_NAME_SUBSTRING = 2;
const SCORE_COUNTRY_PREFIX = 3;
const SCORE_COUNTRY_SUBSTRING = 4;
const SCORE_NONE = Number.POSITIVE_INFINITY;

/** Aliases are a fallback for what the user actually typed, so they rank last. */
const ALIAS_PENALTY = 0.5;

function scoreTerm(entry: IndexedCity, term: string): number {
  if (!term) return SCORE_NONE;
  if (entry.name.startsWith(term)) return SCORE_NAME_PREFIX;
  const at = entry.name.indexOf(term);
  if (at >= 0) {
    return entry.wordStarts.includes(at) ? SCORE_NAME_WORD : SCORE_NAME_SUBSTRING;
  }
  if (entry.country.startsWith(term)) return SCORE_COUNTRY_PREFIX;
  if (entry.country.includes(term)) return SCORE_COUNTRY_SUBSTRING;
  return SCORE_NONE;
}

/**
 * Rank the city list against a free-text query.
 *
 * An empty query returns the curated head of the list, which doubles as the
 * "suggested cities" panel before the user types anything.
 */
export function searchCities(query: string, limit = 40): City[] {
  const q = fold(query);
  if (!q) return CITIES.slice(0, limit);

  // Aliases fire on partial input too ("mec" → Makkah), so the results stay
  // useful while the user is still typing.
  const aliasTargets = FOLDED_ALIASES.filter(
    ([alias]) => alias.startsWith(q) || q.startsWith(alias),
  ).map(([, target]) => target);

  const scored: { entry: IndexedCity; score: number }[] = [];
  for (const entry of INDEX) {
    let score = scoreTerm(entry, q);
    for (const target of aliasTargets) {
      const viaAlias = scoreTerm(entry, target) + ALIAS_PENALTY;
      if (viaAlias < score) score = viaAlias;
    }
    if (score !== SCORE_NONE) scored.push({ entry, score });
  }

  scored.sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.entry.order - b.entry.order,
  );
  return scored.slice(0, limit).map((s) => s.entry.city);
}

/** Exact lookup, used when re-hydrating a saved city by name. */
export function findCity(name: string, country?: string): City | null {
  const n = fold(name);
  const c = country ? fold(country) : null;
  return (
    INDEX.find((e) => e.name === n && (c === null || e.country === c))?.city ??
    null
  );
}

// ---------------------------------------------------------------------------
// Nearest-city lookup
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearestCity {
  city: City;
  km: number;
}

/**
 * The closest city in the built-in list to a coordinate.
 *
 * This is what lets a GPS fix still show a place name when the reverse-geocode
 * request fails — offline, blocked by a content blocker, or on a flaky mobile
 * connection. The name is only a label: the times are always computed from the
 * true coordinates, never from the matched city's.
 */
export function findNearestCity(lat: number, lng: number): NearestCity {
  let best = CITIES[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const city of CITIES) {
    const km = distanceKm(lat, lng, city.lat, city.lng);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  return { city: best, km: bestKm };
}
