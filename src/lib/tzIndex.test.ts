import { describe, expect, it } from 'vitest';

import type { City } from '../data/cities';
import { toTzIndex } from './tzIndex';

const prague: City = {
  slug: 'prague',
  name: 'Prague',
  coords: '50.08°N, 14.44°E',
  longitude: 14.42076,
  timeZone: 'Europe/Prague',
  altNames: ['Praha'],
  population: 1165000,
};

describe('toTzIndex', () => {
  it('keeps only the fields the geo fallback resolver reads', () => {
    expect(toTzIndex([prague])).toEqual([
      { slug: 'prague', timeZone: 'Europe/Prague', population: 1165000 },
    ]);
  });

  it('drops name, altNames, longitude and coords', () => {
    const [entry] = toTzIndex([prague]);
    expect(entry).not.toHaveProperty('name');
    expect(entry).not.toHaveProperty('altNames');
    expect(entry).not.toHaveProperty('longitude');
    expect(entry).not.toHaveProperty('coords');
  });
});
