/**
 * citySlug — turns selected GeoNames records into the shipped `City[]`, with
 * deterministic, collision-free URL slugs and human-readable coordinates.
 *
 * Slug rule (deterministic, reproducible):
 *  1. kebab-case of the ASCII name (e.g. "São Paulo"→"sao-paulo" — ASCII col is
 *     already unaccented, so this is plain lowercasing + separator collapse).
 *  2. On collision, append `-{countryCode}` (e.g. "barcelona-ve").
 *  3. Still colliding → append `-{geonameId}`, which is globally unique.
 */

import type { GeoNameRecord } from './geonames';

/** A city shipped in the dataset. Mirrors `src/data/cities.ts` `City` shape. */
export interface City {
  /** URL slug, unique across the dataset. */
  slug: string;
  /** Display name (ASCII). */
  name: string;
  /** Human-readable coordinates for the eyebrow, e.g. "50.08°N, 14.44°E". */
  coords: string;
  /** Geographic longitude, east positive (degrees). */
  longitude: number;
  /** IANA time zone id — preserved (not a numeric offset) for DST correctness. */
  timeZone: string;
  /** Alternate names for fuzzy search; may be empty. */
  altNames: readonly string[];
  /** Population — tie-breaker for zone resolution and search ranking. */
  population: number;
  /**
   * English country name for search disambiguation (e.g. "Spain"). Absent when
   * the source code is empty/invalid/unknown — see {@link resolveCountryName}.
   */
  country?: string;
}

/**
 * English region-name resolver, built once and shared across the projection.
 * `fallback: 'none'` makes `.of` return `undefined` for a well-formed but
 * unassigned code (e.g. "XX") instead of echoing the code back.
 */
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

/**
 * ISO 3166-1 "unknown/unspecified" sentinel. CLDR *does* map it to a display
 * name ("Unknown Region"), so `fallback: 'none'` alone won't reject it — guard
 * it explicitly so we never surface a bogus "· Unknown Region" label.
 */
const UNKNOWN_REGION_CODE = 'ZZ';

/**
 * Resolves an ISO 3166-1 alpha-2 country code to its English display name at
 * build time via the built-in `Intl.DisplayNames` (no dependency).
 *
 * Returns `undefined` for every "unknown" state — so the UI shows no country
 * and never a dangling `·`: an empty code, the `ZZ` unknown-region sentinel, a
 * structurally invalid code (`.of` throws `RangeError`), or a well-formed but
 * unassigned code (`.of` returns `undefined` under `fallback: 'none'`, e.g.
 * "XX"). Only a genuinely resolved name is returned.
 *
 * @param code - Raw ISO alpha-2 country code from the dump (may be empty).
 * @returns The English country name, or `undefined` when it can't be resolved.
 */
export const resolveCountryName = (code: string): string | undefined => {
  const normalized = code.trim().toUpperCase();
  if (normalized === '' || normalized === UNKNOWN_REGION_CODE) return undefined;
  try {
    // `|| undefined` collapses both the `fallback: 'none'` undefined and any
    // empty-string result to a single "unresolved" value.
    return regionNames.of(normalized) || undefined;
  } catch {
    // RangeError for a structurally invalid code (e.g. "1", a single letter).
    return undefined;
  }
};

/**
 * Formats a lat/lon pair into the eyebrow string, e.g. "50.08°N, 14.44°E".
 * Two decimals, hemisphere letters (avoids signs the UI would have to explain).
 *
 * @param latitude - Degrees, north positive.
 * @param longitude - Degrees, east positive.
 * @returns Formatted coordinate string.
 */
export const formatCoords = (latitude: number, longitude: number): string => {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
};

/**
 * Slugifies an ASCII place name: lowercase, non-alphanumerics → single hyphens,
 * trimmed. Returns "" only for names with no alphanumerics (never expected from
 * the P-class dump; callers still fall back to the id).
 *
 * @param name - ASCII place name.
 * @returns Kebab-case slug base.
 */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Builds the final `City[]` from selected records, resolving slug collisions
 * deterministically and sorting the output by slug so the emitted JSON is
 * byte-stable across builds.
 *
 * @param records - Selected GeoNames records.
 * @returns Cities with unique slugs, sorted by slug.
 */
export const toCities = (records: readonly GeoNameRecord[]): City[] => {
  // Count base-slug frequency first so we only disambiguate real collisions.
  const baseCount = new Map<string, number>();
  for (const record of records) {
    const base = slugify(record.name) || String(record.geonameId);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }

  const used = new Set<string>();
  const cities: City[] = [];
  for (const record of records) {
    const base = slugify(record.name) || String(record.geonameId);
    let slug = base;
    if ((baseCount.get(base) ?? 0) > 1) {
      slug = `${base}-${record.countryCode.toLowerCase()}`;
    }
    // Country suffix can still collide (two same-name cities, same country) →
    // fall back to the globally unique geonameId.
    if (used.has(slug)) {
      slug = `${base}-${record.geonameId}`;
    }
    used.add(slug);

    // Spread `country` only when resolved — with exactOptionalPropertyTypes an
    // optional field must be absent, not `undefined`. Absent → dropped from JSON.
    const country = resolveCountryName(record.countryCode);
    cities.push({
      slug,
      name: record.name,
      coords: formatCoords(record.latitude, record.longitude),
      longitude: record.longitude,
      timeZone: record.timeZone,
      altNames: record.altNames,
      population: record.population,
      ...(country !== undefined && { country }),
    });
  }

  return cities.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
};
