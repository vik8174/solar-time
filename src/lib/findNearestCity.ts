/**
 * findNearestCity — resolves a GPS fix to the closest city in the lean geo
 * index, for the "near {city}" label on the live home page (`/`). Pure: the
 * caller passes the index (kept out of small bundles); no DOM, no I/O.
 *
 * Distance is the haversine great-circle distance — accurate enough to rank the
 * nearest of ~1000 cities and to gate the ~100 km "near" threshold. The label
 * layer, not this function, decides whether the nearest city is close enough to
 * show (see `homeView`).
 */
import type { GeoCity } from './geoIndex';

/** Earth mean radius in kilometres (haversine). */
const EARTH_RADIUS_KM = 6371;

/** The nearest city plus how far the point is from it. */
export interface NearestCity {
  city: GeoCity;
  /** Great-circle distance from the query point, kilometres. */
  distanceKm: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two lat/lon points, in kilometres. */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Finds the city closest to a point.
 *
 * @param lat - Query latitude, north positive (degrees).
 * @param lon - Query longitude, east positive (degrees).
 * @param index - Lean geo index to search.
 * @returns The closest city and its distance, or `null` if the index is empty.
 */
export const findNearestCity = (
  lat: number,
  lon: number,
  index: readonly GeoCity[],
): NearestCity | null => {
  let best: NearestCity | null = null;
  for (const city of index) {
    const distanceKm = haversineKm(lat, lon, city.lat, city.lon);
    if (best === null || distanceKm < best.distanceKm) {
      best = { city, distanceKm };
    }
  }
  return best;
};
