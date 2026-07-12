import { describe, expect, it } from 'vitest';

import type { Deviation } from '../domain/solarTime';
import { seoMeta } from './seoMeta';

// A deviation where the clock runs ahead of the sun (positive total), with a
// solar noon after 12:00. Only `total` and `solarNoon` reach the meta; the
// component fields are present to satisfy the type.
const ahead: Deviation = {
  longitudeOffset: 12,
  equationOfTime: 4,
  dst: 32,
  total: 48,
  solarNoon: 12 * 60 + 48, // 12:48
};

const behind: Deviation = {
  longitudeOffset: -6,
  equationOfTime: -5,
  dst: 0,
  total: -11,
  solarNoon: 11 * 60 + 49, // 11:49
};

const synced: Deviation = {
  longitudeOffset: 0,
  equationOfTime: 0,
  dst: 0,
  total: 0,
  solarNoon: 12 * 60, // 12:00
};

const prague = { name: 'Prague', slug: 'prague' };

describe('seoMeta', () => {
  it('titles the page with the city name for keyword-matched search', () => {
    expect(seoMeta(prague, ahead).title).toBe('Solar time in Prague');
  });

  it('derives the canonical path from the slug', () => {
    expect(seoMeta(prague, ahead).canonicalPath).toBe('/prague');
  });

  it('points every page at the shared brand OG card (D-019 / #131)', () => {
    expect(seoMeta(prague, ahead).ogImagePath).toBe('/og/home.png');
  });

  it('uses the brand OG card regardless of the deviation', () => {
    expect(seoMeta(prague, behind).ogImagePath).toBe('/og/home.png');
    expect(seoMeta(prague, synced).ogImagePath).toBe('/og/home.png');
  });

  it('describes an ahead deviation with the number, direction, and solar noon', () => {
    const { description } = seoMeta(prague, ahead);
    expect(description).toContain('Prague');
    expect(description).toContain('48 minutes');
    expect(description).toContain('ahead of the sun');
    expect(description).toContain('12:48');
  });

  it('describes a behind deviation with the opposite direction', () => {
    const { description } = seoMeta(prague, behind);
    expect(description).toContain('11 minutes');
    expect(description).toContain('behind the sun');
    expect(description).toContain('11:49');
  });

  it('uses the singular "minute" for a one-minute deviation', () => {
    const oneMin: Deviation = { ...ahead, total: 1, solarNoon: 12 * 60 + 1 };
    expect(seoMeta(prague, oneMin).description).toContain('1 minute ');
  });

  it('describes the in-sync edge case without a signed number', () => {
    const { description } = seoMeta(prague, synced);
    expect(description).toContain('in sync with the sun');
    expect(description).toContain('12:00');
    expect(description).not.toMatch(/[+-]\d/);
  });

  it('treats fractional deviations below 1 minute as in-sync (0.6 min)', () => {
    const rounded: Deviation = {
      ...ahead,
      total: 0.6,
      solarNoon: 12 * 60,
    };
    const { description } = seoMeta(prague, rounded);
    expect(description).toContain('in sync with the sun');
  });

  it('treats fractional deviations below 1 minute as in-sync (0.4 min)', () => {
    const rounded: Deviation = {
      ...ahead,
      total: 0.4,
      solarNoon: 12 * 60,
    };
    const { description } = seoMeta(prague, rounded);
    expect(description).toContain('in sync with the sun');
  });

  it('treats negative fractional deviations below 1 minute as in-sync (-0.6 min)', () => {
    const rounded: Deviation = {
      ...behind,
      total: -0.6,
      solarNoon: 11 * 60 + 59,
    };
    const { description } = seoMeta(prague, rounded);
    expect(description).toContain('in sync with the sun');
  });

  it('treats negative fractional deviations below 1 minute as in-sync (-0.4 min)', () => {
    const rounded: Deviation = {
      ...behind,
      total: -0.4,
      solarNoon: 12 * 60,
    };
    const { description } = seoMeta(prague, rounded);
    expect(description).toContain('in sync with the sun');
  });

  it('handles edge case near in-sync threshold (0.99 minutes → in-sync)', () => {
    const nearSync: Deviation = {
      ...synced,
      total: 0.99,
      solarNoon: 12 * 60,
    };
    const { description } = seoMeta(prague, nearSync);
    expect(description).toContain('in sync with the sun');
  });

  it('handles edge case just above in-sync threshold (1.01 minutes → "1 minute")', () => {
    const justAboveSync: Deviation = {
      ...synced,
      total: 1.01,
      solarNoon: 12 * 60 + 1,
    };
    const { description } = seoMeta(prague, justAboveSync);
    expect(description).toContain('1 minute ahead of the sun');
  });

  it('handles edge case with negative value near threshold (-0.99 → in-sync)', () => {
    const nearSyncNeg: Deviation = {
      ...synced,
      total: -0.99,
      solarNoon: 12 * 60,
    };
    const { description } = seoMeta(prague, nearSyncNeg);
    expect(description).toContain('in sync with the sun');
  });

  it('handles edge case with negative value just below threshold (-1.01 → "-1 minute")', () => {
    const justBelowSync: Deviation = {
      ...synced,
      total: -1.01,
      solarNoon: 11 * 60 + 59,
    };
    const { description } = seoMeta(prague, justBelowSync);
    expect(description).toContain('1 minute behind the sun');
  });

  it('handles solar noon with wrap-around time (1439 minutes = 23:59)', () => {
    const lastMinute: Deviation = {
      ...ahead,
      total: 48,
      solarNoon: 23 * 60 + 59, // 23:59
    };
    const { description } = seoMeta(prague, lastMinute);
    expect(description).toContain('23:59');
  });

  it('handles solar noon wrap from late evening to early morning (1500 minutes wraps to 00:00)', () => {
    const wrapped: Deviation = {
      ...ahead,
      total: 48,
      solarNoon: 24 * 60, // Will wrap to 00:00
    };
    const { description } = seoMeta(prague, wrapped);
    expect(description).toContain('00:00');
  });

  it('uses plural "minutes" for a large deviation', () => {
    const large: Deviation = { ...ahead, total: 120, solarNoon: 14 * 60 };
    expect(seoMeta(prague, large).description).toContain('120 minutes');
  });

  it('preserves city name across all deviation types', () => {
    const cities = ['Prague', 'Tokyo', 'New York', 'Sydney'];
    cities.forEach((cityName) => {
      const city = { name: cityName, slug: cityName.toLowerCase() };
      expect(seoMeta(city, ahead).description).toContain(cityName);
    });
  });
});
