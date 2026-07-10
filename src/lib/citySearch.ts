/**
 * citySearch — pure, DOM-free fuzzy city search over the lean client index.
 *
 * The React island (`CitySearch`) is a thin shell over these functions: it
 * fetches the shipped index, calls `buildCityIndex` once, then `searchCities`
 * per keystroke. Keeping the logic here (not in the component) puts the fuzzy
 * ranking under the D-012 coverage gate and lets it be unit-tested without a DOM.
 *
 * Matching is diacritic- and case-insensitive: both the indexed strings and the
 * query are normalized (NFD → strip combining marks → lowercase), so
 * "munchen" / "München" / "MUNICH" all resolve to the same city. Fuzzy typo
 * tolerance (1–2 typos) comes from Fuse's edit-distance scoring.
 */
import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * The lean, client-shipped shape of a city — just what search needs. Derived
 * from the full registry at build time (see `toSearchIndex`); longitude,
 * timeZone, population and coords are deliberately dropped to keep the payload
 * small (ADR D-016, the D-013 exception).
 */
export interface SearchCity {
  /** URL slug — where a selection navigates (`/${slug}`). */
  slug: string;
  /** Display name, shown in the suggestion list. */
  name: string;
  /** Alternate spellings/exonyms for fuzzy matching (e.g. "Kiev" → Kyiv). */
  altNames: readonly string[];
  /**
   * English country name shown as the default secondary hint (e.g. "Spain") to
   * disambiguate same-named cities. Absent when the source code didn't resolve.
   */
  country?: string;
}

/**
 * A single search hit: the matched city, plus the alternate name that caused it
 * — set *only* when the match came via an alt (an exonym like "Kiev"→Kyiv), not
 * the canonical name. Lets the UI show the alt as the *reason* a row matched
 * (issue #43) while defaulting to the country for a plain name match.
 */
export interface CityMatch {
  /** The matched city. */
  readonly city: SearchCity;
  /** The original-cased alt that produced the match; absent for a name match. */
  readonly matchedAlt?: string;
}

/** An index entry carrying pre-normalized search fields alongside the city. */
interface IndexedCity {
  readonly city: SearchCity;
  /** Normalized display name. */
  readonly name: string;
  /** Normalized alternate names. */
  readonly altNames: readonly string[];
}

/** Opaque prebuilt index — build once, reuse across queries. */
export type CityIndex = Fuse<IndexedCity>;

/** Default cap on returned suggestions — enough to scan, short enough to skim. */
const DEFAULT_LIMIT = 8;

const FUSE_OPTIONS: IFuseOptions<IndexedCity> = {
  // Search the normalized mirrors, not the raw fields. Name outweighs alt names
  // so the canonical spelling ranks above an exonym match.
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'altNames', weight: 0.3 },
  ],
  // Tolerate 1–2 typos without matching everything; ignoreLocation so a match
  // anywhere in the string counts (city names are short).
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 1,
  // Expose which key matched so `searchCities` can tell a name match (→ show
  // country) from an alt match (→ show the alt as the reason, issue #43).
  includeMatches: true,
};

/**
 * Normalizes text for accent- and case-insensitive matching: decomposes
 * accented characters, strips the combining diacritical marks, lowercases and
 * trims. "München" → "munchen", "  MADRID " → "madrid".
 *
 * @param value - Raw text (a query or an indexed field).
 * @returns The normalized, comparison-ready string.
 */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Builds a reusable fuzzy index from the lean city list. Call once per index
 * payload; pass the result to `searchCities` for each query.
 *
 * @param cities - The lean search index (`toSearchIndex(registry)`).
 * @returns A prebuilt {@link CityIndex}.
 */
export const buildCityIndex = (cities: readonly SearchCity[]): CityIndex =>
  new Fuse<IndexedCity>(
    cities.map((city) => ({
      city,
      name: normalizeText(city.name),
      altNames: city.altNames.map(normalizeText),
    })),
    FUSE_OPTIONS,
  );

/**
 * Runs a fuzzy query against a prebuilt index, best match first.
 *
 * @param index - Index from {@link buildCityIndex}.
 * @param query - Raw user input; normalized internally.
 * @param limit - Max suggestions to return (default {@link DEFAULT_LIMIT}).
 * @returns Ranked {@link CityMatch} hits; empty for a blank query. Each hit
 *   carries `matchedAlt` only when the match came via an alternate name.
 */
export const searchCities = (
  index: CityIndex,
  query: string,
  limit: number = DEFAULT_LIMIT,
): CityMatch[] => {
  const normalized = normalizeText(query);
  if (normalized === '') return [];
  return index.search(normalized, { limit }).map((result) => {
    const { city } = result.item;
    // Show the alt as the reason only when the match came *via* an alt (no name
    // key) — a canonical-name match is self-explanatory and defaults to country.
    const nameMatched = result.matches?.some((match) => match.key === 'name') ?? false;
    const altMatches = result.matches?.filter((match) => match.key === 'altNames') ?? [];
    // Several alts can match one query ("praha" hits Praag/Prag/Praha). Prefer the
    // one the user actually typed; otherwise fall back to the first (lowest
    // refIndex) for a deterministic pick — never show an unrelated spelling.
    const altMatch = altMatches.find((match) => match.value === normalized) ?? altMatches[0];
    // `refIndex` maps back to the parallel raw `city.altNames`, so we surface the
    // original-cased alt ("München"), not the normalized index form ("munchen").
    const matchedAlt =
      !nameMatched && altMatch?.refIndex !== undefined
        ? city.altNames[altMatch.refIndex]
        : undefined;
    return matchedAlt !== undefined ? { city, matchedAlt } : { city };
  });
};
