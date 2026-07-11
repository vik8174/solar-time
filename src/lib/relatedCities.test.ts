import { describe, expect, it } from 'vitest';

import { type RelatedCity, relatedCities } from './relatedCities';

/**
 * Synthetic fixtures — deliberately NOT real dataset slugs. #116 reshapes
 * `cities.json` slugs in parallel; testing the selector's *behaviour* on made-up
 * cities keeps these tests stable regardless of what the registry says (handoff).
 */
const city = (
  slug: string,
  timeZone: string,
  population: number,
  lat: number,
  lon: number,
): RelatedCity => ({ slug, name: slug.toUpperCase(), timeZone, population, lat, lon });

// A dense zone (UTC+1-ish) plus a couple of far-away outliers in other zones.
const berlin = city('berlin', 'Europe/Berlin', 3_600_000, 52.52, 13.4);
const madrid = city('madrid', 'Europe/Madrid', 3_200_000, 40.42, -3.7);
const warsaw = city('warsaw', 'Europe/Warsaw', 1_800_000, 52.23, 21.01);
const rome = city('rome', 'Europe/Rome', 2_800_000, 41.9, 12.5);
const paris = city('paris', 'Europe/Paris', 2_100_000, 48.85, 2.35);
const oslo = city('oslo', 'Europe/Oslo', 700_000, 59.91, 10.75);
const prague = city('prague', 'Europe/Prague', 1_300_000, 50.09, 14.42);
const tokyo = city('tokyo', 'Asia/Tokyo', 9_700_000, 35.68, 139.7);

// Everyone shares Europe/Berlin here so "same time zone" has plenty of members.
const oneZone = [
  city('a', 'Europe/Berlin', 900, 52, 13),
  city('b', 'Europe/Berlin', 800, 52, 13),
  city('c', 'Europe/Berlin', 700, 52, 13),
  city('d', 'Europe/Berlin', 600, 52, 13),
  city('e', 'Europe/Berlin', 500, 52, 13),
  city('f', 'Europe/Berlin', 400, 52, 13),
  city('g', 'Europe/Berlin', 300, 52, 13),
];

describe('relatedCities', () => {
  it('excludes the current city from its own related list', () => {
    const result = relatedCities(berlin, [berlin, madrid, warsaw, rome]);
    expect(result.map((c) => c.slug)).not.toContain('berlin');
  });

  it('caps the result at the requested number', () => {
    const result = relatedCities(oneZone[0]!, oneZone, 4);
    expect(result).toHaveLength(4);
  });

  it('prefers same-time-zone cities, most populous first (deterministic)', () => {
    // berlin is UTC+1 alone here; the four Europe/Berlin peers would be in a
    // dense-zone scenario. Build one: all in Europe/Berlin.
    const zone = [
      city('big', 'Europe/Berlin', 5_000_000, 52, 13),
      city('mid', 'Europe/Berlin', 3_000_000, 52, 13),
      city('small', 'Europe/Berlin', 1_000_000, 52, 13),
      city('self', 'Europe/Berlin', 2_000_000, 52, 13),
    ];
    const result = relatedCities(zone[3]!, zone, 6);
    expect(result.map((c) => c.slug)).toEqual(['big', 'mid', 'small']);
  });

  it('breaks population ties by slug for a stable order', () => {
    const zone = [
      city('self', 'Europe/Berlin', 100, 52, 13),
      city('zebra', 'Europe/Berlin', 500, 52, 13),
      city('alpha', 'Europe/Berlin', 500, 52, 13),
    ];
    const result = relatedCities(zone[0]!, zone, 6);
    expect(result.map((c) => c.slug)).toEqual(['alpha', 'zebra']);
  });

  it('falls back to nearest-by-distance when the zone is a singleton', () => {
    // tokyo is the only Asia/Tokyo city → zero same-zone peers. It must fall
    // back to the geographically nearest cities among the rest.
    const result = relatedCities(tokyo, [tokyo, berlin, madrid, warsaw, rome, paris]);
    expect(result.length).toBeGreaterThan(0);
    // All results come from other zones (there is no same-tz peer), nearest first.
    // Berlin/Warsaw (further east) are closer to Tokyo than Madrid (far west).
    expect(result[0]!.slug).not.toBe('madrid');
  });

  it('tops up with nearest cities when the zone has too few members', () => {
    // A two-member zone with a cap of 4: both same-zone peers first, then the
    // two nearest out-of-zone cities fill the remaining slots.
    const zoneA1 = city('zone-a-1', 'Zone/A', 1000, 50, 10);
    const zoneA2 = city('zone-a-2', 'Zone/A', 900, 50.1, 10.1);
    const near = city('near', 'Zone/B', 100, 50.2, 10.2);
    const far = city('far', 'Zone/C', 100, 0, 100);
    const result = relatedCities(zoneA1, [zoneA1, zoneA2, near, far], 4);
    // zone-a-2 (same tz) comes before out-of-zone fills; near before far.
    expect(result.map((c) => c.slug)).toEqual(['zone-a-2', 'near', 'far']);
  });

  it('does not duplicate a city already picked from the same zone', () => {
    const zoneA1 = city('zone-a-1', 'Zone/A', 1000, 50, 10);
    const zoneA2 = city('zone-a-2', 'Zone/A', 900, 50.1, 10.1);
    const other = city('other', 'Zone/B', 100, 50.2, 10.2);
    const result = relatedCities(zoneA1, [zoneA1, zoneA2, other], 6);
    const slugs = result.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(['zone-a-2', 'other']);
  });

  it('returns an empty list when there are no other cities', () => {
    expect(relatedCities(prague, [prague])).toEqual([]);
  });

  it('returns only slug and name (crawlable link shape)', () => {
    const result = relatedCities(berlin, [berlin, madrid, oslo]);
    const first = result[0]!;
    expect(Object.keys(first).sort()).toEqual(['name', 'slug']);
    expect(typeof first.slug).toBe('string');
    expect(typeof first.name).toBe('string');
  });
});
