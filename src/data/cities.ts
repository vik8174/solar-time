/**
 * cities — the city registry that drives SSG paths and the client recompute.
 * Hardcoded to a single city for this slice; slice #5 replaces this with a
 * generated dataset. IANA zone is stored (not a numeric offset) so DST stays
 * correct across dates.
 */

/** A city the site can render a page for. */
export interface City {
  /** URL slug, e.g. "prague". */
  slug: string;
  /** Display name. */
  name: string;
  /** Human-readable coordinates for the eyebrow. */
  coords: string;
  /** Geographic longitude, east positive (degrees). */
  longitude: number;
  /** IANA time zone id. */
  timeZone: string;
}

/** All cities with a pre-rendered page. */
export const CITIES: readonly City[] = [
  {
    slug: 'prague',
    name: 'Prague',
    coords: '50.08°N, 14.44°E',
    longitude: 14.4378,
    timeZone: 'Europe/Prague',
  },
];

/**
 * Looks up a city by slug.
 *
 * @param slug - URL slug.
 * @returns The city, or undefined if unknown.
 */
export const getCity = (slug: string): City | undefined =>
  CITIES.find((city) => city.slug === slug);
