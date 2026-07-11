import { describe, expect, it } from 'vitest';

import { DEFAULT_OG_TOP_K, type OgRankable, topOgCitySlugs } from './ogPolicy';

/** Builds a rankable city with just the fields the policy reads. */
const city = (slug: string, population: number): OgRankable => ({ slug, population });

describe('topOgCitySlugs', () => {
  it('selects the top-k cities by population', () => {
    const cities = [city('a', 100), city('b', 300), city('c', 200), city('d', 50)];
    expect(topOgCitySlugs(cities, 2)).toEqual(new Set(['b', 'c']));
  });

  it('ignores input order (ranks purely by population)', () => {
    const ascending = [city('d', 50), city('a', 100), city('c', 200), city('b', 300)];
    const descending = [...ascending].reverse();
    expect(topOgCitySlugs(ascending, 2)).toEqual(topOgCitySlugs(descending, 2));
  });

  it('breaks population ties deterministically by slug ascending', () => {
    const cities = [city('zebra', 100), city('alpha', 100), city('mango', 100)];
    // All tied on population → the two lexicographically smallest slugs win.
    expect(topOgCitySlugs(cities, 2)).toEqual(new Set(['alpha', 'mango']));
  });

  it('is stable across shuffled inputs at the tie boundary', () => {
    const cities = [city('zebra', 100), city('alpha', 100), city('mango', 100)];
    const shuffled = [city('mango', 100), city('zebra', 100), city('alpha', 100)];
    expect(topOgCitySlugs(cities, 2)).toEqual(topOgCitySlugs(shuffled, 2));
  });

  it('returns every slug when k exceeds the city count', () => {
    const cities = [city('a', 100), city('b', 200)];
    expect(topOgCitySlugs(cities, 10)).toEqual(new Set(['a', 'b']));
  });

  it('selects nothing for a non-positive k', () => {
    const cities = [city('a', 100), city('b', 200)];
    expect(topOgCitySlugs(cities, 0)).toEqual(new Set());
    expect(topOgCitySlugs(cities, -5)).toEqual(new Set());
  });

  it('defaults k to DEFAULT_OG_TOP_K', () => {
    // One more than the cap → exactly the lowest-population slug is excluded.
    const cities = Array.from({ length: DEFAULT_OG_TOP_K + 1 }, (_, i) =>
      city(`c${String(i).padStart(5, '0')}`, DEFAULT_OG_TOP_K + 1 - i),
    );
    const selected = topOgCitySlugs(cities);
    expect(selected.size).toBe(DEFAULT_OG_TOP_K);
    // The last city (lowest population) is the one dropped.
    expect(selected.has(`c${String(DEFAULT_OG_TOP_K).padStart(5, '0')}`)).toBe(false);
  });

  it('does not mutate the input array', () => {
    const cities = [city('a', 100), city('b', 300), city('c', 200)];
    const snapshot = [...cities];
    topOgCitySlugs(cities, 2);
    expect(cities).toEqual(snapshot);
  });
});
