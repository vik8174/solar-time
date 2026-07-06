import { describe, expect, it } from 'vitest';

import { buildCityIndex, searchCities, type SearchCity } from './citySearch';

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

const slugsFor = (query: string): string[] =>
  searchCities(buildCityIndex(cities), query).map((c) => c.slug);

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
});
