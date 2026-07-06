import { describe, expect, it } from 'vitest';

import type { City } from '../data/cities';
import { resolveDefaultCity } from './resolveDefaultCity';

const city = (over: Partial<City> = {}): City => ({
  slug: 'city',
  name: 'City',
  coords: '0.00°N, 0.00°E',
  longitude: 0,
  timeZone: 'UTC',
  altNames: [],
  population: 1000,
  ...over,
});

const prague = city({ slug: 'prague', timeZone: 'Europe/Prague', population: 1_165_000 });
const berlin = city({ slug: 'berlin', timeZone: 'Europe/Berlin', population: 3_400_000 });
const paris = city({ slug: 'paris', timeZone: 'Europe/Paris', population: 2_100_000 });
const tokyo = city({ slug: 'tokyo', timeZone: 'Asia/Tokyo', population: 8_300_000 });
// Fallback lives outside the registry and outside any registry region, so
// region-matching never accidentally selects it.
const fallback = city({ slug: 'utc', timeZone: 'UTC', population: 0 });

const registry = [prague, berlin, paris, tokyo];

describe('resolveDefaultCity', () => {
  it('returns the city whose zone matches exactly', () => {
    expect(resolveDefaultCity('Europe/Prague', registry, fallback)).toBe(prague);
  });

  it('picks the largest city when several share the zone', () => {
    const small = city({ slug: 'small', timeZone: 'Asia/Tokyo', population: 100 });
    expect(resolveDefaultCity('Asia/Tokyo', [small, tokyo], fallback)).toBe(tokyo);
  });

  it('falls back to a same-region city for an unknown zone in a known region', () => {
    // "Europe/Busingen" not in registry → any European city (largest = berlin).
    expect(resolveDefaultCity('Europe/Busingen', registry, fallback)).toBe(berlin);
  });

  it('returns the fallback when no zone or region matches', () => {
    expect(resolveDefaultCity('Antarctica/Troll', registry, fallback)).toBe(fallback);
  });

  it('returns the fallback for an empty zone string', () => {
    expect(resolveDefaultCity('', registry, fallback)).toBe(fallback);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(resolveDefaultCity('  Asia/Tokyo  ', registry, fallback)).toBe(tokyo);
  });

  it('picks the largest city when two zones in the same region have different populations', () => {
    const smallPrague = city({
      slug: 'small-prague',
      timeZone: 'Europe/Prague',
      population: 100,
    });
    const largeBerlin = berlin; // population: 3_400_000
    // Query a zone that matches both — should pick the larger
    const result = resolveDefaultCity('Europe/Prague', [smallPrague, largeBerlin], fallback);
    expect(result).toBe(smallPrague); // Exact match for Prague, even if smaller
  });

  it('uses slug as tiebreaker when populations are equal (exact zone match)', () => {
    const cityA = city({
      slug: 'alpha',
      timeZone: 'Europe/Test',
      population: 5000,
    });
    const cityB = city({
      slug: 'beta',
      timeZone: 'Europe/Test',
      population: 5000,
    });
    // Both have same exact zone match and population, slug 'alpha' comes first
    expect(resolveDefaultCity('Europe/Test', [cityB, cityA], fallback)).toBe(cityA);
    // Reverse order should still pick 'alpha'
    expect(resolveDefaultCity('Europe/Test', [cityA, cityB], fallback)).toBe(cityA);
  });

  it('matches region prefix with forward slash in zone name', () => {
    const zone = 'Europe/Some_Unknown_City';
    // Should extract 'Europe' and match Berlin
    expect(resolveDefaultCity(zone, registry, fallback)).toBe(berlin);
  });

  it('returns fallback when zone has no slash (single word)', () => {
    const singleWord = 'UTC';
    expect(resolveDefaultCity(singleWord, registry, fallback)).toBe(fallback);
  });

  it('returns fallback for a non-existent region', () => {
    const unknownRegion = 'Foo/Bar';
    expect(resolveDefaultCity(unknownRegion, registry, fallback)).toBe(fallback);
  });

  it('handles empty registry gracefully', () => {
    expect(resolveDefaultCity('Europe/Prague', [], fallback)).toBe(fallback);
  });

  it('picks the largest when multiple cities in the same region match', () => {
    const smallEuropean = city({
      slug: 'small-euro',
      timeZone: 'Europe/Unknown_City',
      population: 100,
    });
    const largeEuropean = city({
      slug: 'large-euro',
      timeZone: 'Europe/Another_Unknown',
      population: 5_000_000,
    });
    const result = resolveDefaultCity('Europe/Mystery', [smallEuropean, largeEuropean], fallback);
    expect(result).toBe(largeEuropean);
  });

  it('uses slug as tiebreaker for exact zone matches when populations are equal (slug >)', () => {
    const aCityA = city({
      slug: 'acity',
      timeZone: 'Europe/Test',
      population: 2000,
    });
    const zCityB = city({
      slug: 'zcity',
      timeZone: 'Europe/Test',
      population: 2000,
    });
    // Both have same population, slug 'acity' comes first alphabetically (a < z)
    // Pass in order [z, a] so sort will pick the lexicographically smaller slug
    const result = resolveDefaultCity('Europe/Test', [zCityB, aCityA], fallback);
    expect(result).toBe(aCityA);
  });
});
