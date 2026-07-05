/**
 * geonames — pure parsing + deterministic selection of the GeoNames
 * `cities15000` dump into the city dataset. Zero I/O: takes the raw TSV text,
 * returns plain records. The build script (`buildCities.ts`) owns file reads
 * and JSON writes; everything reproducible and testable lives here.
 *
 * Determinism: no `Date`, no randomness. Stable sorts with fixed tie-breakers
 * (population desc, then geonameId asc) so `cities.json` is byte-stable across
 * builds — clean diffs, cacheable output.
 */

/** A single parsed GeoNames populated-place row (only the fields we keep). */
export interface GeoNameRecord {
  /** Stable GeoNames id — used as the final tie-breaker. */
  geonameId: number;
  /** ASCII place name (dump column 3). */
  name: string;
  /** Latitude in degrees, north positive. */
  latitude: number;
  /** Longitude in degrees, east positive. */
  longitude: number;
  /** ISO country code (dump column 9). */
  countryCode: string;
  /** Population; rows with population <= 0 are dropped. */
  population: number;
  /** IANA time zone id (dump column 18) — preserved for DST correctness. */
  timeZone: string;
  /** Alternate names for fuzzy search, de-duplicated; may be empty. */
  altNames: readonly string[];
}

/** GeoNames dump column indices (0-based) for the fields we read. */
const COL = {
  geonameId: 0,
  name: 2, // asciiname — ASCII-only, safe for slugs
  altNames: 3,
  latitude: 4,
  longitude: 5,
  countryCode: 8,
  population: 14,
  timeZone: 17,
} as const;

/** Max alternate names kept per city — caps dataset size, keeps search useful. */
const MAX_ALT_NAMES = 8;

/**
 * Parses one dump line. Returns undefined for malformed rows or rows missing a
 * required field (name / coordinates / timezone) or with non-positive
 * population — defensive against dump drift (fail soft per row, not per build).
 *
 * @param line - One tab-separated dump line.
 * @returns The parsed record, or undefined if the row should be skipped.
 */
export const parseLine = (line: string): GeoNameRecord | undefined => {
  const f = line.split('\t');
  const geonameId = Number(f[COL.geonameId]);
  const name = f[COL.name]?.trim() ?? '';
  const latitude = Number(f[COL.latitude]);
  const longitude = Number(f[COL.longitude]);
  const countryCode = f[COL.countryCode]?.trim() ?? '';
  const population = Number(f[COL.population]);
  const timeZone = f[COL.timeZone]?.trim() ?? '';

  const valid =
    Number.isFinite(geonameId) &&
    name !== '' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    timeZone !== '' &&
    Number.isFinite(population) &&
    population > 0;
  if (!valid) return undefined;

  const altNames = parseAltNames(f[COL.altNames] ?? '', name);

  return {
    geonameId,
    name,
    latitude,
    longitude,
    countryCode,
    population,
    timeZone,
    altNames,
  };
};

/**
 * Parses the comma-separated alternate-names column into a bounded, cleaned
 * list: ASCII-ish entries only (search is Latin-script for v1), no duplicates,
 * excluding the primary name, capped at {@link MAX_ALT_NAMES}.
 *
 * @param raw - The raw alternatenames column.
 * @param primary - The primary name, excluded from the result.
 * @returns De-duplicated alternate names, in dump order, capped.
 */
const parseAltNames = (raw: string, primary: string): readonly string[] => {
  if (raw === '') return [];
  const seen = new Set<string>([primary.toLowerCase()]);
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim();
    // Latin-script only: skip Cyrillic/CJK/Arabic/etc. transliterations.
    if (name === '' || !/^[\x20-\x7E]+$/.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_ALT_NAMES) break;
  }
  return out;
};

/**
 * Parses the whole dump text into records, skipping malformed/ineligible rows.
 *
 * @param text - Full `cities15000.txt` content.
 * @returns Every eligible record, in dump order.
 */
export const parseDump = (text: string): GeoNameRecord[] => {
  const out: GeoNameRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const record = parseLine(line);
    if (record) out.push(record);
  }
  return out;
};

/** Population desc, then geonameId asc — stable, no ties left unresolved. */
const byPopulationThenId = (a: GeoNameRecord, b: GeoNameRecord): number =>
  b.population - a.population || a.geonameId - b.geonameId;

/**
 * Deterministically selects ~`targetSize` cities from parsed records.
 *
 * Two-pass, so the result is both population-weighted and time-zone-complete:
 *  1. Take the top cities by population (the recognizable, high-traffic set).
 *  2. Ensure every IANA zone present in the source has at least one city — add
 *     the largest city of any zone the top pass missed. This guarantees
 *     `resolveDefaultCity(browserTimeZone)` can always resolve an exact zone.
 *
 * The final list is sorted by geonameId so the emitted JSON is byte-stable.
 *
 * @param records - Parsed records (any order).
 * @param targetSize - Desired dataset size (population pass takes this many).
 * @returns Selected records, sorted by geonameId (stable).
 */
export const selectCities = (
  records: readonly GeoNameRecord[],
  targetSize: number,
): GeoNameRecord[] => {
  const sorted = [...records].sort(byPopulationThenId);

  const selected = new Map<number, GeoNameRecord>();
  for (const record of sorted.slice(0, Math.max(0, targetSize))) {
    selected.set(record.geonameId, record);
  }

  // Zone-completeness pass: `sorted` is population-desc, so the first record
  // seen for a zone is its largest city.
  const coveredZones = new Set<string>();
  for (const record of selected.values()) coveredZones.add(record.timeZone);
  for (const record of sorted) {
    if (coveredZones.has(record.timeZone)) continue;
    coveredZones.add(record.timeZone);
    selected.set(record.geonameId, record);
  }

  return [...selected.values()].sort((a, b) => a.geonameId - b.geonameId);
};
