/**
 * relatedCities — picks a small set of other cities to link from a `/[city]`
 * page, so the pages interlink instead of sitting as isolated leaves (issue #87,
 * internal-linking half).
 *
 * **Relation, in priority order:**
 * 1. **Same time zone** — the most product-true link for this tool. Cities that
 *    share a UTC offset but sit at different longitudes have *different* solar
 *    deviations, which is exactly what the site is about. Ranked most-populous
 *    first so the links point at recognisable places; ties broken by slug for a
 *    deterministic, date-independent build.
 * 2. **Nearest by great-circle distance** — fills the remaining slots when a zone
 *    has too few members. 272 of the ~355 zones in the dataset are singletons, so
 *    this fallback is load-bearing, not an edge case.
 *
 * Pure and build-time only (D-013): the page computes this in `getStaticPaths`
 * over the full `CITIES` registry and emits plain `<a href>` anchors — the
 * registry never reaches the client. Slugs are read from the registry, never
 * hardcoded, so a #116 slug reshuffle is reflected on the next build for free.
 */
import type { City } from '../data/cities';
import { haversineKm } from './findNearestCity';
import { parseLatitude } from './geoIndex';

/** Default number of related links per page. */
export const RELATED_CAP = 6;

/** A city reduced to what the relation ranking needs. */
export interface RelatedCity {
  /** URL slug (drives the `<a href>`). */
  slug: string;
  /** Display name (the link text). */
  name: string;
  /** IANA time zone id — the primary relation key. */
  timeZone: string;
  /** Population — same-zone ranking, most populous first. */
  population: number;
  /** Latitude, north positive (degrees) — nearest-city fallback. */
  lat: number;
  /** Longitude, east positive (degrees) — nearest-city fallback. */
  lon: number;
}

/** The minimal crawlable link shape emitted per related city. */
export interface RelatedLink {
  slug: string;
  name: string;
}

/**
 * Projects a full registry `City` onto the lean shape `relatedCities` needs.
 * Latitude is parsed from the human `coords` string (the registry stores no
 * numeric latitude), reusing the same parser as the geo index.
 *
 * @param city - A full registry city.
 * @returns The lean `RelatedCity` projection.
 */
export const toRelatedCity = (city: City): RelatedCity => ({
  slug: city.slug,
  name: city.name,
  timeZone: city.timeZone,
  population: city.population,
  lat: parseLatitude(city.coords),
  lon: city.longitude,
});

/** Case-stable slug comparison for deterministic tie-breaks. */
const bySlug = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Selects the related cities to link from a given city's page.
 *
 * @param current - The city whose page is being built.
 * @param registry - The full lean registry to choose from (may include `current`).
 * @param cap - Maximum number of links to return (default {@link RELATED_CAP}).
 * @returns Up to `cap` `{ slug, name }` links, current city excluded, in a
 *   deterministic order (same-zone by population, then nearest by distance).
 */
export const relatedCities = (
  current: RelatedCity,
  registry: readonly RelatedCity[],
  cap: number = RELATED_CAP,
): RelatedLink[] => {
  const others = registry.filter((c) => c.slug !== current.slug);

  // Primary: same time zone, most populous first (deterministic, date-independent).
  const picked = others
    .filter((c) => c.timeZone === current.timeZone)
    .sort((a, b) => b.population - a.population || bySlug(a.slug, b.slug))
    .slice(0, cap);

  // Fallback: top up with the nearest out-of-zone cities by great-circle distance.
  if (picked.length < cap) {
    const chosen = new Set(picked.map((c) => c.slug));
    const nearest = others
      .filter((c) => !chosen.has(c.slug))
      .map((c) => ({ city: c, distanceKm: haversineKm(current.lat, current.lon, c.lat, c.lon) }))
      .sort((a, b) => a.distanceKm - b.distanceKm || bySlug(a.city.slug, b.city.slug))
      .slice(0, cap - picked.length)
      .map((n) => n.city);
    picked.push(...nearest);
  }

  return picked.map(({ slug, name }) => ({ slug, name }));
};
