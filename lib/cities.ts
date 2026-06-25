import type { Loc } from "./types";

type CityTuple = [name: string, country: string, lat: number, lng: number, tz: string];

/**
 * Searchable city list (lat, lng, IANA timezone). Weighted toward cities with
 * large Shia communities, plus major global cities for travellers.
 */
const RAW: CityTuple[] = [
  ["Najaf", "Iraq", 32.0, 44.3333, "Asia/Baghdad"],
  ["Karbala", "Iraq", 32.616, 44.0242, "Asia/Baghdad"],
  ["Baghdad", "Iraq", 33.3152, 44.3661, "Asia/Baghdad"],
  ["Samarra", "Iraq", 34.1959, 43.8742, "Asia/Baghdad"],
  ["Basra", "Iraq", 30.5085, 47.7804, "Asia/Baghdad"],
  ["Qom", "Iran", 34.6401, 50.8764, "Asia/Tehran"],
  ["Tehran", "Iran", 35.6892, 51.389, "Asia/Tehran"],
  ["Mashhad", "Iran", 36.2605, 59.6168, "Asia/Tehran"],
  ["Isfahan", "Iran", 32.6546, 51.668, "Asia/Tehran"],
  ["Shiraz", "Iran", 29.5918, 52.5837, "Asia/Tehran"],
  ["Tabriz", "Iran", 38.08, 46.2919, "Asia/Tehran"],
  ["Makkah", "Saudi Arabia", 21.4225, 39.8262, "Asia/Riyadh"],
  ["Madinah", "Saudi Arabia", 24.5247, 39.5692, "Asia/Riyadh"],
  ["Qatif", "Saudi Arabia", 26.5196, 49.9962, "Asia/Riyadh"],
  ["Dammam", "Saudi Arabia", 26.4207, 50.0888, "Asia/Riyadh"],
  ["Manama", "Bahrain", 26.2285, 50.586, "Asia/Bahrain"],
  ["Kuwait City", "Kuwait", 29.3759, 47.9774, "Asia/Kuwait"],
  ["Dubai", "UAE", 25.2048, 55.2708, "Asia/Dubai"],
  ["Abu Dhabi", "UAE", 24.4539, 54.3773, "Asia/Dubai"],
  ["Muscat", "Oman", 23.588, 58.3829, "Asia/Muscat"],
  ["Sanaa", "Yemen", 15.3694, 44.191, "Asia/Aden"],
  ["Beirut", "Lebanon", 33.8938, 35.5018, "Asia/Beirut"],
  ["Damascus", "Syria", 33.5138, 36.2765, "Asia/Damascus"],
  ["Baku", "Azerbaijan", 40.4093, 49.8671, "Asia/Baku"],
  ["Istanbul", "Türkiye", 41.0082, 28.9784, "Europe/Istanbul"],
  ["Kabul", "Afghanistan", 34.5553, 69.2075, "Asia/Kabul"],
  ["Herat", "Afghanistan", 34.3529, 62.204, "Asia/Kabul"],
  ["Karachi", "Pakistan", 24.8607, 67.0011, "Asia/Karachi"],
  ["Lahore", "Pakistan", 31.5204, 74.3587, "Asia/Karachi"],
  ["Lucknow", "India", 26.8467, 80.9462, "Asia/Kolkata"],
  ["Hyderabad", "India", 17.385, 78.4867, "Asia/Kolkata"],
  ["Mumbai", "India", 19.076, 72.8777, "Asia/Kolkata"],
  ["Delhi", "India", 28.6139, 77.209, "Asia/Kolkata"],
  ["Cairo", "Egypt", 30.0444, 31.2357, "Africa/Cairo"],
  ["London", "UK", 51.5074, -0.1278, "Europe/London"],
  ["Birmingham", "UK", 52.4862, -1.8904, "Europe/London"],
  ["Paris", "France", 48.8566, 2.3522, "Europe/Paris"],
  ["Berlin", "Germany", 52.52, 13.405, "Europe/Berlin"],
  ["Stockholm", "Sweden", 59.3293, 18.0686, "Europe/Stockholm"],
  ["Toronto", "Canada", 43.6532, -79.3832, "America/Toronto"],
  ["Ottawa", "Canada", 45.4215, -75.6972, "America/Toronto"],
  ["Montreal", "Canada", 45.5017, -73.5673, "America/Toronto"],
  ["Vancouver", "Canada", 49.2827, -123.1207, "America/Vancouver"],
  ["Calgary", "Canada", 51.0447, -114.0719, "America/Edmonton"],
  ["Dearborn", "USA", 42.3223, -83.1763, "America/Detroit"],
  ["New York", "USA", 40.7128, -74.006, "America/New_York"],
  ["Chicago", "USA", 41.8781, -87.6298, "America/Chicago"],
  ["Houston", "USA", 29.7604, -95.3698, "America/Chicago"],
  ["Los Angeles", "USA", 34.0522, -118.2437, "America/Los_Angeles"],
  ["Sydney", "Australia", -33.8688, 151.2093, "Australia/Sydney"],
  ["Melbourne", "Australia", -37.8136, 144.9631, "Australia/Melbourne"],
];

export interface City extends Loc {
  tz: string;
}

export const CITIES: City[] = RAW.map(([name, country, lat, lng, tz]) => ({
  name,
  country,
  lat,
  lng,
  tz,
}));

export function searchCities(query: string, limit = 40): City[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q),
      )
    : CITIES;
  return list.slice(0, limit);
}

export const DEFAULT_CITY: City = CITIES.find((c) => c.name === "Vancouver")!;
