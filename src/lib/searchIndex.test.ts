import { describe, expect, it } from 'vitest';

import type { City } from '../data/cities';
import { toSearchIndex } from './searchIndex';

const prague: City = {
  slug: 'prague',
  name: 'Prague',
  coords: '50.08°N, 14.44°E',
  longitude: 14.42076,
  timeZone: 'Europe/Prague',
  altNames: ['Praha'],
  population: 1165000,
};

describe('toSearchIndex', () => {
  it('keeps only the fields search needs (slug, name, altNames)', () => {
    expect(toSearchIndex([prague])).toEqual([
      { slug: 'prague', name: 'Prague', altNames: ['Praha'] },
    ]);
  });

  it('drops longitude, timeZone, population and coords to keep the payload lean', () => {
    const [entry] = toSearchIndex([prague]);
    expect(entry).not.toHaveProperty('longitude');
    expect(entry).not.toHaveProperty('timeZone');
    expect(entry).not.toHaveProperty('population');
    expect(entry).not.toHaveProperty('coords');
  });
});
