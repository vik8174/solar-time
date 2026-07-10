import { describe, expect, it } from 'vitest';

import {
  buildCityIndex,
  normalizeText,
  searchCities,
  type CityMatch,
  type SearchCity,
} from './citySearch';

const city = (name: string, slug = name.toLowerCase(), altNames: string[] = []): SearchCity => ({
  slug,
  name,
  altNames,
});

const cities: readonly SearchCity[] = [
  city('Prague', 'prague', ['Praha']),
  city('Munich', 'munich', ['München', 'Muenchen']),
  city('Kyiv', 'kyiv', ['Kiev']),
  city('Madrid'),
  city('Kashgar', 'kashgar', ['Kashi']),
];

/** The matched cities of a query result, dropping match provenance. */
const citiesOf = (results: readonly CityMatch[]): SearchCity[] => results.map((m) => m.city);

const slugsFor = (query: string): string[] =>
  citiesOf(searchCities(buildCityIndex(cities), query)).map((c) => c.slug);

describe('normalizeText', () => {
  it('converts to lowercase', () => {
    expect(normalizeText('PRAGUE')).toBe('prague');
    expect(normalizeText('Prague')).toBe('prague');
  });

  it('strips diacritics', () => {
    expect(normalizeText('München')).toBe('munchen');
    expect(normalizeText('Zürich')).toBe('zurich');
    expect(normalizeText('São Paulo')).toBe('sao paulo');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  Prague  ')).toBe('prague');
    expect(normalizeText('\tMadrid\n')).toBe('madrid');
  });

  it('handles mixed case and diacritics', () => {
    expect(normalizeText('  MÜNCHEN  ')).toBe('munchen');
    expect(normalizeText('SÃO PAULO')).toBe('sao paulo');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeText('   ')).toBe('');
    expect(normalizeText('\t\n')).toBe('');
  });

  it('preserves spaces within words', () => {
    expect(normalizeText('New York')).toBe('new york');
    expect(normalizeText('San Francisco')).toBe('san francisco');
  });
});

describe('searchCities', () => {
  it('finds a city by an exact name match', () => {
    expect(slugsFor('Prague')).toContain('prague');
  });

  it('is case-insensitive', () => {
    expect(slugsFor('MADRID')).toContain('madrid');
    expect(slugsFor('madrid')).toContain('madrid');
  });

  it('ignores diacritics in the query and the index', () => {
    // Query lacks the umlaut; index entry "München" has it.
    expect(slugsFor('munchen')).toContain('munich');
    // Query has the umlaut; matches the same city.
    expect(slugsFor('München')).toContain('munich');
  });

  it('matches on alternate names (exonyms)', () => {
    expect(slugsFor('Kiev')).toContain('kyiv');
    expect(slugsFor('Kashi')).toContain('kashgar');
  });

  it('tolerates one or two typos', () => {
    expect(slugsFor('Prag')).toContain('prague'); // dropped chars
    expect(slugsFor('Madird')).toContain('madrid'); // transposition
  });

  it('ranks the exact name match first', () => {
    expect(slugsFor('Prague')[0]).toBe('prague');
  });

  it('returns an empty array for a blank or whitespace query', () => {
    const index = buildCityIndex(cities);
    expect(searchCities(index, '')).toEqual([]);
    expect(searchCities(index, '   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(slugsFor('zzzzzzzz')).toEqual([]);
  });

  it('caps the number of results at the given limit', () => {
    const many: SearchCity[] = Array.from({ length: 20 }, (_, i) =>
      city(`Springfield ${i}`, `s${i}`),
    );
    const results = searchCities(buildCityIndex(many), 'Springfield', 5);
    expect(results).toHaveLength(5);
  });

  it('normalizes multiple diacritics correctly', () => {
    const zurich = city('Zürich', 'zurich', ['Zürich', 'Zurich']);
    // Query with umlaut, diacritic in alt names, all should match
    expect(citiesOf(searchCities(buildCityIndex([zurich]), 'Zürich'))).toContain(zurich);
    expect(citiesOf(searchCities(buildCityIndex([zurich]), 'Zurich'))).toContain(zurich);
    expect(citiesOf(searchCities(buildCityIndex([zurich]), 'zurich'))).toContain(zurich);
  });

  it('handles complex diacritics (cedilla, ring, tilde)', () => {
    const cities_special: SearchCity[] = [
      city('São Paulo', 'sao-paulo'),
      city('Søtokken', 'sotokken'),
      city('Niño', 'nino'),
    ];
    const index = buildCityIndex(cities_special);
    // All should normalize and match without diacritics
    expect(citiesOf(searchCities(index, 'Sao Paulo'))).toContain(cities_special[0]);
    expect(citiesOf(searchCities(index, 'Sotokken'))).toContain(cities_special[1]);
    expect(citiesOf(searchCities(index, 'Nino'))).toContain(cities_special[2]);
  });

  it('preserves ranking when multiple results have fuzzy matches', () => {
    const cities_dup: SearchCity[] = [
      city('New York', 'new-york'),
      city('New Delhi', 'new-delhi'),
      city('Newcastle', 'newcastle'),
    ];
    const index = buildCityIndex(cities_dup);
    const results = searchCities(index, 'new');
    // All three match 'new' but Fuse ranks by relevance; verify all are returned
    expect(results).toHaveLength(3);
    expect(citiesOf(results).map((c) => c.slug)).toEqual(
      expect.arrayContaining(['new-york', 'new-delhi', 'newcastle']),
    );
  });

  it('tolerates leading and trailing whitespace in queries', () => {
    const index = buildCityIndex(cities);
    // Internal normalization trims whitespace
    expect(citiesOf(searchCities(index, '  Prague  '))).toContain(cities[0]);
    expect(citiesOf(searchCities(index, '\tMadrid\t'))).toContain(cities[3]);
  });

  it('returns results in a consistent order across repeated searches', () => {
    const index = buildCityIndex(cities);
    const results1 = searchCities(index, 'a');
    const results2 = searchCities(index, 'a');
    expect(citiesOf(results1).map((c) => c.slug)).toEqual(citiesOf(results2).map((c) => c.slug));
  });

  it('does not match when typo tolerance is exceeded', () => {
    const index = buildCityIndex(cities);
    // Too many typos / too different
    expect(searchCities(index, 'xxxxxx')).toEqual([]);
    expect(searchCities(index, 'pppppragueee')).toEqual([]);
  });

  it('handles single-character queries', () => {
    const index = buildCityIndex(cities);
    const results = searchCities(index, 'M');
    // Should match Madrid and Munich
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((m) => m.city.slug === 'madrid')).toBe(true);
  });

  it('respects custom limit of 1', () => {
    const index = buildCityIndex(cities);
    const results = searchCities(index, 'a', 1);
    expect(results).toHaveLength(1);
  });

  it('handles a limit larger than available results', () => {
    const index = buildCityIndex(cities);
    const results = searchCities(index, 'Prague', 100);
    // Only Prague matches 'Prague' exactly (others have no match)
    expect(results).toHaveLength(1);
    expect(results[0]!.city.slug).toBe('prague');
  });
});

describe('searchCities — match provenance (#43)', () => {
  const index = buildCityIndex(cities);

  it('leaves matchedAlt unset for a canonical-name match', () => {
    const [result] = searchCities(index, 'Madrid');
    expect(result?.city.slug).toBe('madrid');
    expect(result?.matchedAlt).toBeUndefined();
  });

  it('leaves matchedAlt unset when the name matches even if an alt also would', () => {
    // "Munich" matches both its name and its alt "Muenchen"; the name wins, so
    // the row defaults to the country rather than surfacing an alt.
    const [result] = searchCities(index, 'Munich');
    expect(result?.city.slug).toBe('munich');
    expect(result?.matchedAlt).toBeUndefined();
  });

  it('surfaces the matched alt when the match came via an alternate name', () => {
    const [result] = searchCities(index, 'Kiev');
    expect(result?.city.slug).toBe('kyiv');
    expect(result?.matchedAlt).toBe('Kiev');
  });

  it('surfaces the alt the user actually typed when several alts match', () => {
    // "praha" fuzzy-matches Praag/Prag/Praha alike; showing "Praag" as the reason
    // for a "Praha" query would be baffling — prefer the exact one.
    const praha = city('Prague', 'prague', ['Praag', 'Prag', 'Praha']);
    const [result] = searchCities(buildCityIndex([praha]), 'Praha');
    expect(result?.matchedAlt).toBe('Praha');
  });

  it('returns the original-cased alt, not the normalized index form', () => {
    // Query "munchen" matches Munich only via its alt "München" — the surfaced
    // alt must be the original casing/diacritics, not the normalized "munchen".
    const [result] = searchCities(index, 'munchen');
    expect(result?.city.slug).toBe('munich');
    expect(result?.matchedAlt).toBe('München');
  });
});
