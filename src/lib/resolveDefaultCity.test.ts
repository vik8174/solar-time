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
});
