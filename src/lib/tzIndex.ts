/**
 * tzIndex — derives the lean timezone→city payload used only by the search
 * island's geo fallback. Pure and build-time: `/tz-index.json` maps `CITIES`
 * through this, and the island fetches it lazily *only* when the user triggers
 * "use my location" on an empty result.
 *
 * Kept separate from the search index (ADR D-016): search never needs timeZone,
 * and the fallback never needs names/altNames — so each payload stays minimal
 * and is fetched only in its own scenario. Feeds the pure `resolveDefaultCity`
 * (which reads exactly `{ slug, timeZone, population }` — see `ZoneCity`).
 *
 * ⚠️ Scope boundary with slice #7: this powers a *timezone-based* guess (no GPS,
 * no permission prompt), the same heuristic the home default uses. True precise
 * geolocation (the "📍 my position" GPS mode) is slice #7's job.
 */
import type { City } from '../data/cities';
import type { ZoneCity } from './resolveDefaultCity';

/**
 * Projects the full registry onto the lean tz-resolution index.
 *
 * @param cities - The full city registry.
 * @returns One `{ slug, timeZone, population }` entry per city.
 */
export const toTzIndex = (cities: readonly City[]): ZoneCity[] =>
  cities.map(({ slug, timeZone, population }) => ({ slug, timeZone, population }));
