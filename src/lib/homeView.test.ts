import { describe, expect, it } from 'vitest';

import type { NearestCity } from './findNearestCity';
import { geoStatusHint, locatedLabel, NEAR_THRESHOLD_KM } from './homeView';

const nearest = (distanceKm: number): NearestCity => ({
  city: { slug: 'prague', name: 'Prague', lat: 50.09, lon: 14.42 },
  distanceKm,
});

describe('locatedLabel', () => {
  it('always leads with "Your location"', () => {
    expect(locatedLabel(nearest(5)).primary).toBe('Your location');
  });

  it('keeps "Your location" even when no city is near', () => {
    expect(locatedLabel(null).primary).toBe('Your location');
  });

  it('names the nearest city when it is within the threshold', () => {
    expect(locatedLabel(nearest(20)).near).toBe('near Prague');
  });

  it('includes the city exactly at the threshold', () => {
    expect(locatedLabel(nearest(NEAR_THRESHOLD_KM)).near).toBe('near Prague');
  });

  it('hides "near" when the closest city is beyond the threshold', () => {
    expect(locatedLabel(nearest(NEAR_THRESHOLD_KM + 0.1)).near).toBeNull();
  });

  it('hides "near" when there is no city to name', () => {
    expect(locatedLabel(null).near).toBeNull();
  });

  it('uses the city name from the nearest city object', () => {
    const customCity = {
      city: { slug: 'custom', name: 'Custom City', lat: 48, lon: 17 },
      distanceKm: 50,
    };
    expect(locatedLabel(customCity).near).toBe('near Custom City');
  });

  it('handles threshold boundary with 0.0 distance', () => {
    expect(locatedLabel(nearest(0)).near).toBe('near Prague');
  });

  it('correctly excludes city just beyond threshold (off-by-one check)', () => {
    const justBeyond = NEAR_THRESHOLD_KM + 0.01;
    expect(locatedLabel(nearest(justBeyond)).near).toBeNull();
  });
});

describe('geoStatusHint', () => {
  it('nudges a denied visitor toward search', () => {
    expect(geoStatusHint('denied')).toMatch(/search/i);
  });

  it('explains a fallback on error', () => {
    expect(geoStatusHint('error')).toMatch(/estimate|time.?zone/i);
  });

  it('explains an unsupported browser', () => {
    expect(geoStatusHint('unsupported')).toMatch(/search/i);
  });

  it('stays silent for the working states', () => {
    expect(geoStatusHint('idle')).toBeNull();
    expect(geoStatusHint('locating')).toBeNull();
    expect(geoStatusHint('located')).toBeNull();
  });
});
