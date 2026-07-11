import { describe, expect, it } from 'vitest';

import type { Deviation } from '../domain/solarTime';
import { cityProse } from './cityProse';

/** Builds a Deviation with sensible defaults, overriding only what a test needs. */
const deviation = (over: Partial<Deviation>): Deviation => ({
  longitudeOffset: 0,
  equationOfTime: 0,
  dst: 0,
  total: 0,
  solarNoon: 720,
  ...over,
});

describe('cityProse', () => {
  it('describes an in-sync city without a lead number', () => {
    const text = cityProse(
      { name: 'Nullville', longitude: 15 },
      deviation({ total: 0.4, longitudeOffset: 0, solarNoon: 720 }),
    );
    expect(text).toContain('Nullville');
    expect(text.toLowerCase()).toContain('step');
    expect(text).toContain('12:00');
    // No signed magnitude claim for an in-sync city.
    expect(text).not.toMatch(/\d+ minutes? (ahead|behind)/);
  });

  it('says "ahead of the sun" when the clock leads (positive total)', () => {
    const text = cityProse(
      { name: 'Prague', longitude: 14.42 },
      deviation({ total: 27, longitudeOffset: 2.3, solarNoon: 747 }),
    );
    expect(text).toContain('Prague');
    expect(text).toMatch(/27 minutes ahead/);
    expect(text).toContain('12:27');
    // Positive longitude offset ⇒ west of the zone meridian.
    expect(text).toContain('west of');
  });

  it('says "behind the sun" when the clock trails (negative total)', () => {
    const text = cityProse(
      { name: 'Eastwood', longitude: 22 },
      deviation({ total: -18, longitudeOffset: -12, solarNoon: 702 }),
    );
    expect(text).toMatch(/18 minutes behind/);
    // Negative longitude offset ⇒ east of the zone meridian.
    expect(text).toContain('east of');
  });

  it('uses the singular "minute" for a one-minute gap', () => {
    const text = cityProse(
      { name: 'One', longitude: 15 },
      deviation({ total: 1, longitudeOffset: 1 }),
    );
    expect(text).toMatch(/1 minute ahead/);
    expect(text).not.toMatch(/1 minutes/);
  });

  it('varies wording by magnitude — slight vs large read differently', () => {
    const slight = cityProse(
      { name: 'Slight', longitude: 15 },
      deviation({ total: 3, longitudeOffset: 1 }),
    );
    const large = cityProse(
      { name: 'Large', longitude: 99 },
      deviation({ total: 55, longitudeOffset: 40 }),
    );
    // The two magnitude bands must not share the same sentence skeleton.
    expect(slight).not.toBe(
      large.replace('Large', 'Slight').replace('55', '3').replace('99.0', '15.0'),
    );
    expect(slight.toLowerCase()).toContain('close');
    expect(large.toLowerCase()).toContain('wide');
  });

  it('formats the longitude with a hemisphere', () => {
    const east = cityProse(
      { name: 'E', longitude: 14.42 },
      deviation({ total: 10, longitudeOffset: 2 }),
    );
    const west = cityProse(
      { name: 'W', longitude: -73.9 },
      deviation({ total: -10, longitudeOffset: -5 }),
    );
    expect(east).toContain('14.4° E');
    expect(west).toContain('73.9° W');
  });

  it('handles the antimeridian edge (wrapped longitude offset) without throwing', () => {
    // Tonga-like: wrapMinutes keeps longitudeOffset in range; prose still resolves.
    const text = cityProse(
      { name: 'Nuku_alofa', longitude: -175.2 },
      deviation({ total: 45, longitudeOffset: 45, solarNoon: 765 }),
    );
    expect(text).toContain('Nuku_alofa');
    expect(text).toContain('175.2° W');
    expect(text.length).toBeGreaterThan(20);
  });

  it('notes the meridian when the longitude offset is ~zero', () => {
    const text = cityProse(
      { name: 'Onmeridian', longitude: 15 },
      deviation({ total: 5, longitudeOffset: 0, solarNoon: 725 }),
    );
    expect(text).toContain('right on');
  });

  it('is genuinely distinct for two cities in the same magnitude band', () => {
    // Same band + direction, different data → materially different rendered text.
    const a = cityProse(
      { name: 'Alpha', longitude: 10 },
      deviation({ total: 15, longitudeOffset: 5, solarNoon: 735 }),
    );
    const b = cityProse(
      { name: 'Beta', longitude: 40 },
      deviation({ total: 20, longitudeOffset: -8, solarNoon: 700 }),
    );
    expect(a).not.toBe(b);
  });
});
