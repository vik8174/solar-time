/**
 * scrubEvent — the privacy scrub run as Sentry's `beforeSend` body (D-008, D-012).
 *
 * The error monitor must never carry a visitor's GPS position off their device
 * (PRD story 30). Sentry events are plain, JSON-safe objects by the time
 * `beforeSend` sees them, so this pure function deep-copies the event and
 * redacts anything that could be a coordinate, across four vectors:
 *
 * 1. **Coordinate-named keys** — any property whose key names a coordinate
 *    (`lat`, `lon`, `latitude`, `longitude`, `coords`, `position`, `geo`, `gps`,
 *    …) has its value replaced wholesale, so a nested
 *    `coords: { latitude, longitude, accuracy }` and everything derived from the
 *    fix go with it.
 * 2. **Coordinate-shaped arrays** — a bare 2-element numeric array that looks
 *    like a `[lat, lon]` pair is redacted even under an unrecognized key.
 * 3. **Query / fragment params** — a `lat=…`/`lon=…` (etc.) parameter after
 *    `?`, `&`, or `#` in any string (covers `request.url`, `query_string`,
 *    breadcrumb URLs), value redacted in place.
 * 4. **Free-text coordinates** — a `50.45, 30.52`-style decimal pair, or a lone
 *    high-precision decimal (≈metre precision), embedded in an error `message`,
 *    `exception.value`, or breadcrumb text.
 *
 * Vectors 2 and 4 are deliberately conservative — they may occasionally redact a
 * benign decimal pair — because leaking a coordinate is the failure that matters.
 * Keeping the whole thing pure (event in → scrubbed event out, no I/O, no SDK)
 * is what lets the privacy guarantee be unit-tested hard, independent of Sentry.
 */

/** Placeholder written in place of any redacted coordinate value. */
export const REDACTED = '[redacted]';

/** Property names (case-insensitive) whose values are dropped entirely. */
const COORD_KEY =
  /^(?:lat|lon|lng|latitude|longitude|coords?|coordinates|position|geo|gps|geolocation)$/i;

/** A `lat=…`/`lon=…` param after `?`, `&`, or `#`, so its value can be cut. */
const COORD_QUERY = /([?&#](?:lat|lon|lng|latitude|longitude)=)[^&#\s]*/gi;

/**
 * A `lat, lon` pair in free text: two decimals (≤3 integer digits, ≥1 fraction)
 * separated by comma/slash/space. The lookbehind stops it biting into a longer
 * number (e.g. a Unix timestamp's tail).
 */
const COORD_PAIR = /(?<![\d.])-?\d{1,3}\.\d+\s*[,/]\s*-?\d{1,3}\.\d+/g;

/** A lone high-precision decimal (≥5 fraction digits ≈ ≤1 m) — near-certainly GPS. */
const HIGH_PRECISION = /(?<![\d.])-?\d{1,3}\.\d{5,}/g;

/** Redacts coordinate params and free-text coordinates inside a string. */
const scrubString = (value: string): string =>
  value
    .replace(COORD_QUERY, `$1${REDACTED}`)
    .replace(COORD_PAIR, REDACTED)
    .replace(HIGH_PRECISION, REDACTED);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** True for a bare 2-number array that plausibly holds `[lat, lon]`. */
const isCoordinatePair = (value: readonly unknown[]): boolean =>
  value.length === 2 &&
  value.every(isFiniteNumber) &&
  value.some((n) => !Number.isInteger(n)) &&
  Math.abs(value[0] as number) <= 180 &&
  Math.abs(value[1] as number) <= 180;

/** Recursively copies a value, redacting coordinates by key, shape, and text. */
const scrubValue = (value: unknown): unknown => {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return isCoordinatePair(value) ? REDACTED : value.map(scrubValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = COORD_KEY.test(key) ? REDACTED : scrubValue(val);
    }
    return out;
  }
  return value;
};

/**
 * Returns a deep copy of a Sentry event with all GPS coordinates removed.
 * Shape-preserving: only coordinate data changes, so Sentry still receives a
 * well-formed, useful event.
 *
 * @param event - The Sentry event passed to `beforeSend`.
 * @returns A scrubbed copy safe to send.
 */
export const scrubEvent = <T>(event: T): T => scrubValue(event) as T;
