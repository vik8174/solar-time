/**
 * citySlug — turns selected GeoNames records into the shipped `City[]`, with
 * deterministic, collision-free URL slugs and human-readable coordinates.
 *
 * Slug rule for a **freshly-assigned** slug (deterministic, reproducible):
 *  1. kebab-case of the ASCII name (e.g. "São Paulo"→"sao-paulo" — ASCII col is
 *     already unaccented, so this is plain lowercasing + separator collapse).
 *  2. On collision, append `-{countryCode}` (e.g. "barcelona-ve").
 *  3. Still colliding → append `-{geonameId}`, which is globally unique.
 *
 * **Slug stability (R-016, layer 2).** A slug is a property of the **city
 * (`geonameId`)**, not of its neighbours. A `geonameId` already in the
 * {@link SlugRegistry} keeps its slug **verbatim, forever** — the rule above
 * only ever assigns slugs to genuinely new ids. So a city entering or leaving
 * the dataset can never rename another city's public `/[city]` URL: upstream
 * drift and #90's scale-up can only *add* slugs. See {@link toCities}.
 */

import type { GeoNameRecord } from './geonames';

/**
 * `geonameId` (as a string key) → committed URL slug. The authoritative,
 * byte-stable record of every slug ever assigned, committed to
 * `scripts/slug-registry.json`. `cities.json` carries no `geonameId`, so this
 * is the single source of truth binding a city to its frozen slug.
 */
export type SlugRegistry = Record<string, string>;

/** The `City[]` plus the registry extended with any newly-assigned slugs. */
export interface ToCitiesResult {
  /** The shipped cities, sorted by slug (byte-stable). */
  cities: City[];
  /**
   * The input registry plus an entry for every `geonameId` freshly assigned
   * this run. The caller commits it so the assignment is frozen from here on.
   */
  registry: SlugRegistry;
}

/**
 * Validates parsed JSON as a {@link SlugRegistry} — the trust boundary for the
 * committed registry file. Fail-fast, because a silently-accepted bad registry
 * is the exact R-016 hazard: a corrupt file must **stop the build**, never let
 * {@link toCities} re-derive frozen URLs.
 *
 * Rejects a non-object, any non-string slug value, and — critically — **duplicate
 * slugs across different ids**. Uniqueness is the registry's whole job (it's the
 * SSOT that keeps two cities off one URL); a hand-edit or bad merge that maps two
 * `geonameId`s to the same slug would otherwise collapse into one claimed slug
 * and ship a `cities.json` with a duplicated route, undetected.
 *
 * @param parsed - The result of `JSON.parse` on the registry file (untrusted).
 * @returns The validated registry (same object, narrowed).
 * @throws When the shape is wrong or a slug is claimed by more than one id.
 */
export const parseSlugRegistry = (parsed: unknown): SlugRegistry => {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Malformed slug registry: expected a JSON object of geonameId → slug');
  }
  const seen = new Map<string, string>();
  for (const [id, slug] of Object.entries(parsed)) {
    if (typeof slug !== 'string') {
      throw new Error(`Malformed slug registry entry ${id}: expected a string slug`);
    }
    const owner = seen.get(slug);
    if (owner !== undefined) {
      throw new Error(
        `Duplicate slug "${slug}" in registry: claimed by both geonameId ${owner} and ${id}`,
      );
    }
    seen.set(slug, id);
  }
  return parsed as SlugRegistry;
};

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
 * Builds the final `City[]` from selected records, resolving slugs against the
 * {@link SlugRegistry} so an existing city's URL can never change (R-016).
 *
 * A `geonameId` already in `registry` reuses its slug **verbatim** — the
 * collision rule below runs **only** for ids absent from it, and every fresh
 * assignment is written into the returned registry (never mutating the input).
 * Freshly-assigned slugs are disambiguated against **both** their same-run
 * peers and every slug already claimed by the registry, so a newcomer can never
 * steal a frozen slug: it falls to `-{countryCode}` and then to the globally
 * unique `-{geonameId}`. Seeding from an **empty** registry reproduces the
 * historical whole-dataset behaviour exactly (every base shared by ≥2 fresh
 * cities gets the country suffix).
 *
 * Output is sorted by slug so the emitted JSON is byte-stable across builds.
 *
 * @param records - Selected GeoNames records.
 * @param registry - Existing `geonameId → slug` map; defaults to empty (seed).
 * @returns The cities (sorted by slug) and the registry extended with new ids.
 */
export const toCities = (
  records: readonly GeoNameRecord[],
  registry: SlugRegistry = {},
): ToCitiesResult => {
  // Copy so the caller's registry is never mutated (immutability).
  const nextRegistry: SlugRegistry = { ...registry };
  // Every slug already frozen by the registry is off-limits to a new city, even
  // if that city isn't in this record set — otherwise a newcomer could claim a
  // departed-but-registered city's URL and break registry-wide uniqueness.
  const claimed = new Set<string>(Object.values(nextRegistry));

  // Records whose id isn't registered yet are the only ones we assign slugs to.
  // Assign in ascending geonameId order so disambiguation (which colliding city
  // takes the country suffix vs. the id fallback) is deterministic regardless of
  // the caller's record order — `toCities` owns its own stability.
  const fresh = records
    .filter((record) => !(String(record.geonameId) in nextRegistry))
    .sort((a, b) => a.geonameId - b.geonameId);

  // Base-slug frequency among the FRESH records, so two brand-new same-name
  // cities in one run are disambiguated symmetrically (the historical behaviour
  // on an empty registry); a lone newcomer that merely clashes with a frozen
  // slug is caught by the `claimed` check below.
  const baseCount = new Map<string, number>();
  for (const record of fresh) {
    const base = slugify(record.name) || String(record.geonameId);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }

  for (const record of fresh) {
    const id = String(record.geonameId);
    const base = slugify(record.name) || id;
    let slug = base;
    // Suffix with the country when the base collides with a fresh peer OR with a
    // slug already frozen by the registry.
    if ((baseCount.get(base) ?? 0) > 1 || claimed.has(base)) {
      slug = `${base}-${record.countryCode.toLowerCase()}`;
    }
    // Country suffix can still collide (same-name, same-country, or a frozen
    // suffix) → fall back to the globally unique geonameId.
    if (claimed.has(slug)) {
      slug = `${base}-${id}`;
    }
    claimed.add(slug);
    nextRegistry[id] = slug;
  }

  const cities: City[] = records.map((record) => {
    const slug = nextRegistry[String(record.geonameId)];
    if (slug === undefined) {
      // Unreachable: every record is either pre-registered or assigned above.
      throw new Error(`No slug assigned for geonameId ${String(record.geonameId)}`);
    }
    // Spread `country` only when resolved — with exactOptionalPropertyTypes an
    // optional field must be absent, not `undefined`. Absent → dropped from JSON.
    const country = resolveCountryName(record.countryCode);
    return {
      slug,
      name: record.name,
      coords: formatCoords(record.latitude, record.longitude),
      longitude: record.longitude,
      timeZone: record.timeZone,
      altNames: record.altNames,
      population: record.population,
      ...(country !== undefined && { country }),
    };
  });

  cities.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { cities, registry: nextRegistry };
};
