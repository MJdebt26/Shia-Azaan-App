/**
 * Temperature units.
 *
 * Almost the whole world reads Celsius; a short list of places does not. Rather
 * than add yet another setting for something the browser already knows, this
 * infers the unit from the user's locale and gets it right silently.
 */

/** Regions that use Fahrenheit for everyday temperatures. */
const FAHRENHEIT_REGIONS: ReadonlySet<string> = new Set([
  "US", // United States
  "BS", // Bahamas
  "BZ", // Belize
  "KY", // Cayman Islands
  "LR", // Liberia
  "PW", // Palau
  "FM", // Micronesia
  "MH", // Marshall Islands
]);

/**
 * True when this locale should see Celsius. Defaults to Celsius, which is both
 * the global majority and the safer guess when the locale is unreadable.
 */
export function prefersCelsius(locale?: string): boolean {
  const tag = locale ?? (typeof navigator !== "undefined" ? navigator.language : "");
  if (!tag) return true;

  // `Intl.Locale` resolves "en-US" → region "US" and also handles the cases a
  // naive split misses, e.g. "en-Latn-US".
  try {
    const region = new Intl.Locale(tag).maximize().region;
    if (region) return !FAHRENHEIT_REGIONS.has(region);
  } catch {
    /* fall through to the string form below */
  }

  const parts = tag.toUpperCase().split(/[-_]/);
  const region = parts.find((p) => p.length === 2 && /^[A-Z]{2}$/.test(p));
  return region ? !FAHRENHEIT_REGIONS.has(region) : true;
}
