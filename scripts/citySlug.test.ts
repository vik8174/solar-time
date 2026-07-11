import { describe, expect, it } from 'vitest';

import { formatCoords, parseSlugRegistry, resolveCountryName, slugify, toCities } from './citySlug';
import type { GeoNameRecord } from './geonames';

const record = (over: Partial<GeoNameRecord> = {}): GeoNameRecord => ({
  geonameId: 1,
  name: 'City',
  latitude: 0,
  longitude: 0,
  countryCode: 'XX',
  population: 1000,
  timeZone: 'UTC',
  altNames: [],
  ...over,
});

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('New York')).toBe('new-york');
  });

  it('collapses runs of non-alphanumerics into a single hyphen', () => {
    expect(slugify("Coeur d'Alene")).toBe('coeur-d-alene');
    expect(slugify('  Rio -- de  Janeiro ')).toBe('rio-de-janeiro');
  });
});

describe('resolveCountryName', () => {
  it('resolves a valid ISO alpha-2 code to its English name', () => {
    expect(resolveCountryName('ES')).toBe('Spain');
    expect(resolveCountryName('UA')).toBe('Ukraine');
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(resolveCountryName('es')).toBe('Spain');
    expect(resolveCountryName('  de  ')).toBe('Germany');
  });

  it('returns undefined for an empty or whitespace code', () => {
    expect(resolveCountryName('')).toBeUndefined();
    expect(resolveCountryName('   ')).toBeUndefined();
  });

  it('returns undefined for a well-formed but unknown code (no "· ZZ")', () => {
    // `.of` echoes the code back for an unassigned region — never surface it.
    expect(resolveCountryName('ZZ')).toBeUndefined();
    expect(resolveCountryName('XX')).toBeUndefined();
  });

  it('returns undefined for a structurally invalid code (RangeError)', () => {
    expect(resolveCountryName('1')).toBeUndefined();
    expect(resolveCountryName('E')).toBeUndefined();
    expect(resolveCountryName('ESP!')).toBeUndefined();
  });
});

describe('formatCoords', () => {
  it('formats north/east with hemisphere letters', () => {
    expect(formatCoords(50.088, 14.4208)).toBe('50.09°N, 14.42°E');
  });

  it('formats south/west hemispheres', () => {
    expect(formatCoords(-33.8688, -70.6693)).toBe('33.87°S, 70.67°W');
  });
});

describe('toCities — projection & fresh assignment (empty registry)', () => {
  it('maps a record to the shipped City shape, resolving the country name', () => {
    const { cities } = toCities([
      record({
        name: 'Prague',
        longitude: 14.42,
        timeZone: 'Europe/Prague',
        altNames: ['Praha'],
        population: 1_165_000,
        countryCode: 'CZ',
      }),
    ]);
    expect(cities[0]).toEqual({
      slug: 'prague',
      name: 'Prague',
      coords: '0.00°N, 14.42°E',
      longitude: 14.42,
      timeZone: 'Europe/Prague',
      altNames: ['Praha'],
      population: 1_165_000,
      country: 'Czechia',
    });
  });

  it('leaves country undefined for an empty or unknown country code', () => {
    // Undefined → dropped by JSON.stringify, so the shipped JSON carries no key
    // and the UI shows no dangling "·".
    const { cities: empty } = toCities([record({ name: 'Nowhere', countryCode: '' })]);
    expect(empty[0]?.country).toBeUndefined();
    const { cities: unknown } = toCities([record({ name: 'Elsewhere', countryCode: 'ZZ' })]);
    expect(unknown[0]?.country).toBeUndefined();
  });

  it('disambiguates same-name cities with a country suffix', () => {
    const { cities } = toCities([
      record({ geonameId: 1, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 2, name: 'Barcelona', countryCode: 'VE' }),
    ]);
    expect(cities.map((c) => c.slug).sort()).toEqual(['barcelona-es', 'barcelona-ve']);
  });

  it('falls back to geonameId when the country suffix still collides', () => {
    const { cities } = toCities([
      record({ geonameId: 10, name: 'Springfield', countryCode: 'US' }),
      record({ geonameId: 20, name: 'Springfield', countryCode: 'US' }),
    ]);
    const slugs = cities.map((c) => c.slug).sort();
    // The first record claims the country suffix; the one that still collides
    // falls back to its OWN geonameId (20), which is globally unique.
    expect(slugs).toContain('springfield-us');
    expect(slugs).toContain('springfield-20');
  });

  it('leaves a unique name as a bare slug', () => {
    expect(toCities([record({ name: 'Reykjavik' })]).cities[0]?.slug).toBe('reykjavik');
  });

  it('sorts output by slug for byte-stable JSON', () => {
    const { cities } = toCities([
      record({ geonameId: 1, name: 'Zurich' }),
      record({ geonameId: 2, name: 'Amsterdam' }),
      record({ geonameId: 3, name: 'Madrid' }),
    ]);
    expect(cities.map((c) => c.slug)).toEqual(['amsterdam', 'madrid', 'zurich']);
  });

  it('produces globally unique slugs', () => {
    const { cities } = toCities([
      record({ geonameId: 1, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 2, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 3, name: 'Barcelona', countryCode: 'VE' }),
    ]);
    expect(new Set(cities.map((c) => c.slug)).size).toBe(3);
  });

  it('records every fresh assignment in the returned registry, keyed by geonameId', () => {
    const { registry } = toCities([
      record({ geonameId: 1, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 2, name: 'Barcelona', countryCode: 'VE' }),
    ]);
    expect(registry).toEqual({ '1': 'barcelona-es', '2': 'barcelona-ve' });
  });

  it('is deterministic — same records produce byte-identical output', () => {
    const records = [
      record({ geonameId: 1, name: 'Zurich' }),
      record({ geonameId: 2, name: 'Amsterdam' }),
    ];
    expect(toCities(records)).toEqual(toCities(records));
  });
});

describe('toCities — slug stability against the registry (R-016)', () => {
  it('reuses a registered slug verbatim instead of re-deriving it', () => {
    const registry = { '1': 'berlin-legacy' };
    const { cities } = toCities(
      [record({ geonameId: 1, name: 'Berlin', countryCode: 'DE' })],
      registry,
    );
    // The record would derive `berlin`, but the frozen `berlin-legacy` wins.
    expect(cities[0]?.slug).toBe('berlin-legacy');
  });

  it('keeps the survivor stable when a colliding same-name city is REMOVED', () => {
    // This is the exact #91 regression: San Juan (AR) leaves the dataset, and
    // pre-registry code would collapse San Juan (PR) from `san-juan-pr` to the
    // bare `san-juan` — silently renaming a live URL. The registry freezes it.
    const registry = { '1': 'san-juan-pr', '2': 'san-juan-ar' };
    const { cities } = toCities(
      [record({ geonameId: 1, name: 'San Juan', countryCode: 'PR' })],
      registry,
    );
    expect(cities[0]?.slug).toBe('san-juan-pr');
  });

  it('keeps the survivor stable when a colliding same-name city is ADDED', () => {
    // PR alone seeds the bare slug; AR then enters. PR must NOT be pushed to a
    // suffix — the newcomer adapts around the frozen slug instead.
    const seeded = toCities([record({ geonameId: 1, name: 'San Juan', countryCode: 'PR' })]);
    expect(seeded.cities[0]?.slug).toBe('san-juan');
    expect(seeded.registry).toEqual({ '1': 'san-juan' });

    const next = toCities(
      [
        record({ geonameId: 1, name: 'San Juan', countryCode: 'PR' }),
        record({ geonameId: 2, name: 'San Juan', countryCode: 'AR' }),
      ],
      seeded.registry,
    );
    const bySlug = next.cities.map((c) => c.slug).sort();
    expect(bySlug).toEqual(['san-juan', 'san-juan-ar']);
    // The frozen id keeps the bare slug; the newcomer took the suffix.
    expect(next.registry['1']).toBe('san-juan');
    expect(next.registry['2']).toBe('san-juan-ar');
  });

  it('gives a new same-name city a suffix when the bare slug is frozen to another id', () => {
    // Only the newcomer (id 2) is present; the frozen id 1 isn't even in this
    // record set, yet its `san-juan` slug is still off-limits.
    const registry = { '1': 'san-juan' };
    const { cities, registry: next } = toCities(
      [record({ geonameId: 2, name: 'San Juan', countryCode: 'AR' })],
      registry,
    );
    expect(cities[0]?.slug).toBe('san-juan-ar');
    expect(next['2']).toBe('san-juan-ar');
  });

  it('assigns a fresh, collision-free slug to an id absent from the registry and records it', () => {
    const registry = { '1': 'berlin' };
    const { cities, registry: next } = toCities(
      [record({ geonameId: 2, name: 'Paris', countryCode: 'FR' })],
      registry,
    );
    expect(cities[0]?.slug).toBe('paris');
    expect(next).toEqual({ '1': 'berlin', '2': 'paris' });
  });

  it('does not mutate the caller-supplied registry', () => {
    const registry = { '1': 'berlin' };
    toCities([record({ geonameId: 2, name: 'Paris', countryCode: 'FR' })], registry);
    expect(registry).toEqual({ '1': 'berlin' });
  });
});

describe('parseSlugRegistry', () => {
  it('accepts a valid geonameId → slug object and returns it', () => {
    const registry = { '1': 'berlin', '2': 'paris' };
    expect(parseSlugRegistry(registry)).toEqual(registry);
  });

  it('accepts an empty registry (the seed case)', () => {
    expect(parseSlugRegistry({})).toEqual({});
  });

  it('rejects a non-object (array, null, primitive)', () => {
    expect(() => parseSlugRegistry([])).toThrow(/expected a JSON object/);
    expect(() => parseSlugRegistry(null)).toThrow(/expected a JSON object/);
    expect(() => parseSlugRegistry('nope')).toThrow(/expected a JSON object/);
  });

  it('rejects a non-string slug value', () => {
    expect(() => parseSlugRegistry({ '1': 42 })).toThrow(/expected a string slug/);
  });

  it('rejects duplicate slugs across different ids (uniqueness is the whole point)', () => {
    // A hand-edit / bad merge that maps two cities to one URL must fail the build,
    // not silently collapse into a single claimed slug.
    expect(() => parseSlugRegistry({ '1': 'san-juan', '2': 'san-juan' })).toThrow(
      /Duplicate slug "san-juan".*geonameId 1 and 2/,
    );
  });
});
