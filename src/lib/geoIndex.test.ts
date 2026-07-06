import { describe, expect, it } from 'vitest';

import type { City } from '../data/cities';
import { parseLatitude, toGeoIndex } from './geoIndex';

const city = (over: Partial<City>): City => ({
  slug: 'prague',
  name: 'Prague',
  coords: '50.09°N, 14.42°E',
  longitude: 14.42,
  timeZone: 'Europe/Prague',
  altNames: [],
  population: 1000,
  ...over,
});

describe('parseLatitude', () => {
  it('reads a northern latitude as positive', () => {
    expect(parseLatitude('50.09°N, 14.42°E')).toBeCloseTo(50.09, 5);
  });

  it('reads a southern latitude as negative', () => {
    expect(parseLatitude('33.87°S, 70.67°W')).toBeCloseTo(-33.87, 5);
  });

  it('reads the equator as zero', () => {
    expect(parseLatitude('0.00°N, 14.42°E')).toBe(0);
  });

  it('reads the north pole (90°N)', () => {
    expect(parseLatitude('90.00°N, 0°E')).toBe(90);
  });

  it('reads the south pole (90°S)', () => {
    expect(parseLatitude('90.00°S, 0°E')).toBe(-90);
  });

  it('parses integers without decimals', () => {
    expect(parseLatitude('50°N, 14°E')).toBe(50);
  });

  it('fails fast on a coordinate string it cannot parse', () => {
    expect(() => parseLatitude('not coordinates')).toThrow(/coords/i);
  });
});

describe('toGeoIndex', () => {
  it('projects each city to slug, name, lat and lon only', () => {
    const [entry] = toGeoIndex([city({})]);
    expect(entry).toEqual({ slug: 'prague', name: 'Prague', lat: 50.09, lon: 14.42 });
  });

  it('rounds both coordinates to 2 decimals to stay lean', () => {
    const [entry] = toGeoIndex([city({ longitude: -70.6693, coords: '33.87°S, 70.67°W' })]);
    expect(entry?.lat).toBe(-33.87);
    expect(entry?.lon).toBe(-70.67);
  });

  it('rounds latitude up when third decimal is ≥5', () => {
    const [entry] = toGeoIndex([city({ coords: '50.095°N, 14.42°E' })]);
    expect(entry?.lat).toBe(50.1);
  });

  it('rounds longitude down when third decimal is <5', () => {
    const [entry] = toGeoIndex([city({ coords: '50.09°N, 14.424°E', longitude: 14.424 })]);
    expect(entry?.lon).toBe(14.42);
  });

  it('handles extreme coordinates (poles)', () => {
    const [entry] = toGeoIndex([city({ coords: '90.00°N, 0°E', longitude: 0 })]);
    expect(entry?.lat).toBe(90);
    expect(entry?.lon).toBe(0);
  });

  it('handles negative coordinates (south and west)', () => {
    const [entry] = toGeoIndex([city({ coords: '45.12°S, 73.56°W', longitude: -73.56 })]);
    expect(entry?.lat).toBe(-45.12);
    expect(entry?.lon).toBe(-73.56);
  });
});
