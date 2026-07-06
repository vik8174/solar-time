import { describe, expect, it } from 'vitest';

import { findNearestCity } from './findNearestCity';
import type { GeoCity } from './geoIndex';

const prague: GeoCity = { slug: 'prague', name: 'Prague', lat: 50.09, lon: 14.42 };
const brno: GeoCity = { slug: 'brno', name: 'Brno', lat: 49.2, lon: 16.61 };
const madrid: GeoCity = { slug: 'madrid', name: 'Madrid', lat: 40.42, lon: -3.7 };

describe('findNearestCity', () => {
  it('returns the closest city to the given point', () => {
    // A point right next to Brno should resolve to Brno, not Prague or Madrid.
    const result = findNearestCity(49.25, 16.6, [prague, brno, madrid]);
    expect(result?.city.slug).toBe('brno');
  });

  it('reports the great-circle distance in kilometres', () => {
    // Prague→Brno is ~185 km; allow slack for the haversine approximation.
    const result = findNearestCity(50.09, 14.42, [brno]);
    expect(result?.distanceKm).toBeGreaterThan(160);
    expect(result?.distanceKm).toBeLessThan(210);
  });

  it('returns ~0 km when the point coincides with a city', () => {
    const result = findNearestCity(50.09, 14.42, [prague]);
    expect(result?.distanceKm).toBeLessThan(1);
  });

  it('returns null for an empty index', () => {
    expect(findNearestCity(50, 14, [])).toBeNull();
  });

  it('handles a single-city index', () => {
    const result = findNearestCity(40, 0, [prague]);
    expect(result?.city.slug).toBe('prague');
    expect(result?.distanceKm).toBeGreaterThan(500);
  });

  it('handles antimeridian longitude (180° wrap)', () => {
    // A point near the dateline should find the nearest city across the wrap
    const eastern: GeoCity = { slug: 'east', name: 'East', lat: 0, lon: 179 };
    const western: GeoCity = { slug: 'west', name: 'West', lat: 0, lon: -179 };
    const result = findNearestCity(0, 179.5, [eastern, western]);
    expect(result?.city.slug).toBe('east');
  });

  it('handles queries at or near the poles', () => {
    const northPole: GeoCity = { slug: 'north', name: 'North Pole', lat: 90, lon: 0 };
    const result = findNearestCity(89.9, 0, [northPole]);
    expect(result?.city.slug).toBe('north');
    expect(result?.distanceKm).toBeLessThan(20);
  });

  it('handles southern and western hemisphere coordinates', () => {
    const southern: GeoCity = { slug: 'south', name: 'South', lat: -45, lon: -73 };
    const result = findNearestCity(-45.1, -73.1, [southern]);
    expect(result?.city.slug).toBe('south');
    expect(result?.distanceKm).toBeLessThan(20);
  });

  it('correctly ranks when multiple cities are equidistant (picks first encountered)', () => {
    // Two cities at exact same distance — the function should pick the first one
    const city1: GeoCity = { slug: 'c1', name: 'City 1', lat: 50, lon: 14 };
    const city2: GeoCity = { slug: 'c2', name: 'City 2', lat: 50, lon: 14 };
    const result = findNearestCity(50, 14, [city1, city2]);
    expect(result?.city.slug).toBe('c1');
  });
});
