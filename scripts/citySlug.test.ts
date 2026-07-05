import { describe, expect, it } from 'vitest';

import { formatCoords, slugify, toCities } from './citySlug';
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

describe('formatCoords', () => {
  it('formats north/east with hemisphere letters', () => {
    expect(formatCoords(50.088, 14.4208)).toBe('50.09°N, 14.42°E');
  });

  it('formats south/west hemispheres', () => {
    expect(formatCoords(-33.8688, -70.6693)).toBe('33.87°S, 70.67°W');
  });
});

describe('toCities', () => {
  it('maps a record to the shipped City shape', () => {
    const [city] = toCities([
      record({
        name: 'Prague',
        longitude: 14.42,
        timeZone: 'Europe/Prague',
        altNames: ['Praha'],
        population: 1_165_000,
      }),
    ]);
    expect(city).toEqual({
      slug: 'prague',
      name: 'Prague',
      coords: '0.00°N, 14.42°E',
      longitude: 14.42,
      timeZone: 'Europe/Prague',
      altNames: ['Praha'],
      population: 1_165_000,
    });
  });

  it('disambiguates same-name cities with a country suffix', () => {
    const cities = toCities([
      record({ geonameId: 1, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 2, name: 'Barcelona', countryCode: 'VE' }),
    ]);
    expect(cities.map((c) => c.slug).sort()).toEqual(['barcelona-es', 'barcelona-ve']);
  });

  it('falls back to geonameId when the country suffix still collides', () => {
    const cities = toCities([
      record({ geonameId: 10, name: 'Springfield', countryCode: 'US' }),
      record({ geonameId: 20, name: 'Springfield', countryCode: 'US' }),
    ]);
    const slugs = cities.map((c) => c.slug).sort();
    expect(slugs).toContain('springfield-us');
    expect(slugs).toContain('springfield-10');
  });

  it('leaves a unique name as a bare slug', () => {
    expect(toCities([record({ name: 'Reykjavik' })])[0]?.slug).toBe('reykjavik');
  });

  it('sorts output by slug for byte-stable JSON', () => {
    const cities = toCities([
      record({ geonameId: 1, name: 'Zurich' }),
      record({ geonameId: 2, name: 'Amsterdam' }),
      record({ geonameId: 3, name: 'Madrid' }),
    ]);
    expect(cities.map((c) => c.slug)).toEqual(['amsterdam', 'madrid', 'zurich']);
  });

  it('produces globally unique slugs', () => {
    const cities = toCities([
      record({ geonameId: 1, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 2, name: 'Barcelona', countryCode: 'ES' }),
      record({ geonameId: 3, name: 'Barcelona', countryCode: 'VE' }),
    ]);
    expect(new Set(cities.map((c) => c.slug)).size).toBe(3);
  });
});
