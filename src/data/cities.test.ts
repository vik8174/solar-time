import { describe, expect, it } from 'vitest';

import { CITIES, getCity } from './cities';

describe('cities dataset', () => {
  it('ships a substantial, generated registry', () => {
    expect(CITIES.length).toBeGreaterThan(900);
  });

  it('has globally unique slugs', () => {
    expect(new Set(CITIES.map((c) => c.slug)).size).toBe(CITIES.length);
  });

  it('stores IANA zones, not numeric offsets', () => {
    // Every zone contains a "/" (Region/City) or is a bare IANA id like "UTC".
    expect(CITIES.every((c) => /^[A-Za-z]/.test(c.timeZone) && !/^[+-]?\d/.test(c.timeZone))).toBe(
      true,
    );
  });
});

describe('getCity', () => {
  it('returns the city for a known slug', () => {
    const first = CITIES[0];
    expect(first).toBeDefined();
    if (first) expect(getCity(first.slug)).toEqual(first);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCity('not-a-real-city-slug')).toBeUndefined();
  });
});
