/**
 * cities — the generated city registry that drives SSG paths, the client
 * recompute, search (slice #6), and default-city resolution.
 *
 * The data is generated at build time by `scripts/buildCities.ts` from the
 * GeoNames `cities15000` dump (CC-BY — footer attribution required, see the
 * footer slice #11) and imported from `cities.json`. IANA zones are stored (not
 * numeric offsets) so DST stays correct across dates.
 *
 * ⚠️ Bundle size: the full registry is ~1000 cities. City pages (`[city].astro`)
 * must NOT import this module into their island — they inline their own city's
 * data via `data-*` attributes. Importing here is fine for the home page (`/`,
 * noindex, live geo) and the build.
 */

import citiesData from './cities.json';

/** A city the site can render a page for and resolve/search against. */
export interface City {
  /** URL slug, unique across the dataset. */
  slug: string;
  /** Display name. */
  name: string;
  /** Human-readable coordinates for the eyebrow, e.g. "50.08°N, 14.44°E". */
  coords: string;
  /** Geographic longitude, east positive (degrees). */
  longitude: number;
  /** IANA time zone id. */
  timeZone: string;
  /** Alternate names for fuzzy search (slice #6); may be empty. */
  altNames: readonly string[];
  /** Population — tie-breaker for zone resolution and search ranking. */
  population: number;
}

/** All cities with a pre-rendered page. */
export const CITIES: readonly City[] = citiesData;

/**
 * Looks up a city by slug.
 *
 * @param slug - URL slug.
 * @returns The city, or undefined if unknown.
 */
export const getCity = (slug: string): City | undefined =>
  CITIES.find((city) => city.slug === slug);
