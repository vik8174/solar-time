/**
 * searchIndex — derives the lean, client-shipped search payload from the full
 * city registry. Pure and build-time: the `/search-index.json` endpoint maps
 * `CITIES` through this, and the island fetches the result lazily.
 *
 * Only `{ slug, name, altNames }` is kept. Search inherently needs *all* cities
 * on the client (unlike the per-page deviation island, D-013), so the payload is
 * kept minimal by dropping everything search doesn't use — longitude, timeZone,
 * population, coords (ADR D-016).
 */
import type { City } from '../data/cities';
import type { SearchCity } from './citySearch';

/**
 * Projects the full registry onto the lean search index.
 *
 * @param cities - The full city registry.
 * @returns One `{ slug, name, altNames }` entry per city.
 */
export const toSearchIndex = (cities: readonly City[]): SearchCity[] =>
  cities.map(({ slug, name, altNames }) => ({ slug, name, altNames }));
