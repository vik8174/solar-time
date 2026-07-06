/**
 * geoIndex — derives the lean geo payload used by the live home page (`/`) to
 * label a GPS fix with its nearest city. Pure and build-time: the
 * `/geo-index.json` endpoint maps `CITIES` through this, and the island fetches
 * the result lazily only when the visitor asks for their location.
 *
 * Only `{ slug, name, lat, lon }` is kept — the minimum `findNearestCity` needs
 * (ADR D-016 philosophy: each index carries only its own fields; search and the
 * tz-index deliberately dropped coordinates). Latitude is parsed from the
 * human-readable `coords` string (the registry stores no numeric latitude);
 * both coordinates are rounded to 2 decimals to keep the payload lean. That
 * ~1 km precision is far below the 100 km "near" threshold and fine for ranking
 * the closest of ~1000 cities — and the exact 📍 result uses the precise GPS
 * longitude, not this index, so the default-city estimate is the only consumer.
 */
import type { City } from '../data/cities';

/** Rounds a coordinate to 2 decimals (~1 km) to keep the index compact. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** A city reduced to what nearest-city ranking and its label need. */
export interface GeoCity {
  /** URL slug. */
  slug: string;
  /** Display name (used in the "near {city}" label). */
  name: string;
  /** Latitude, north positive (degrees). */
  lat: number;
  /** Longitude, east positive (degrees). */
  lon: number;
}

/**
 * Parses the latitude out of a `coords` eyebrow string.
 *
 * @param coords - Formatted coordinates, e.g. "50.09°N, 14.42°E".
 * @returns Signed latitude in degrees (south negative).
 */
export const parseLatitude = (coords: string): number => {
  const match = /^\s*(\d+(?:\.\d+)?)\s*°\s*([NS])/.exec(coords);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Unparseable coords latitude: "${coords}"`);
  }
  const magnitude = Number(match[1]);
  return match[2] === 'S' ? -magnitude : magnitude;
};

/**
 * Projects the full registry onto the lean geo index.
 *
 * @param cities - The full city registry.
 * @returns One `{ slug, name, lat, lon }` entry per city.
 */
export const toGeoIndex = (cities: readonly City[]): GeoCity[] =>
  cities.map(({ slug, name, coords, longitude }) => ({
    slug,
    name,
    lat: round2(parseLatitude(coords)),
    lon: round2(longitude),
  }));
