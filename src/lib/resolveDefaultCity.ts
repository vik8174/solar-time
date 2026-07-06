/**
 * resolveDefaultCity — maps a browser IANA time zone to a city from the
 * dataset, so the home page can show a relevant default without asking for
 * geolocation. Pure: the registry is passed in (keeps it testable and lets the
 * caller control which bundle pulls the full dataset).
 *
 * Matching, in order:
 *  1. Exact zone match (the dataset covers every GeoNames zone, so this is the
 *     common path). Ties → largest population, then slug for determinism.
 *  2. Region-prefix match (same continent, e.g. an unknown "Europe/…" zone
 *     falls back to a European city) — handles zone aliases and gaps.
 *  3. A stable global fallback so the caller never gets undefined.
 */

import type { City } from '../data/cities';

/**
 * The subset of a city this resolver actually reads. Accepting the structural
 * minimum (not the full `City`) lets the search island's geo fallback feed it
 * the lean tz-index (`{ slug, timeZone, population }`, ADR D-016) without
 * shipping the full registry to the client. Full `City` objects still satisfy it.
 */
export type ZoneCity = Pick<City, 'slug' | 'timeZone' | 'population'>;

/** Population desc, then slug asc — deterministic pick among candidates. */
const preferLarger = (a: ZoneCity, b: ZoneCity): number =>
  b.population - a.population || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/**
 * Resolves a browser time zone to the best-matching city.
 *
 * @param browserTimeZone - IANA zone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 * @param registry - City dataset (only slug/timeZone/population are read).
 * @param fallback - City to return when nothing matches (must be in the registry).
 * @returns The best-matching city; `fallback` if the registry has no candidate.
 */
export const resolveDefaultCity = <T extends ZoneCity>(
  browserTimeZone: string,
  registry: readonly T[],
  fallback: T,
): T => {
  const zone = browserTimeZone.trim();

  const exact = registry.filter((c) => c.timeZone === zone).sort(preferLarger);
  if (exact[0]) return exact[0];

  const region = zone.split('/')[0];
  if (region !== undefined && region !== '') {
    const sameRegion = registry
      .filter((c) => c.timeZone.split('/')[0] === region)
      .sort(preferLarger);
    if (sameRegion[0]) return sameRegion[0];
  }

  return fallback;
};
