import { describe, expect, it } from 'vitest';

import type { Deviation } from '../domain/solarTime';
import { ogCardModel } from './ogCard';

const ahead: Deviation = {
  longitudeOffset: 12,
  equationOfTime: 4,
  dst: 32,
  total: 48,
  solarNoon: 12 * 60 + 48,
};

const behind: Deviation = { ...ahead, total: -11, solarNoon: 11 * 60 + 49 };
const synced: Deviation = { ...ahead, total: 0, solarNoon: 12 * 60 };

describe('ogCardModel', () => {
  it('shows the signed number, the "min" unit, and the ahead caption', () => {
    const card = ogCardModel('Prague', ahead);
    expect(card.value).toBe('+48');
    expect(card.unit).toBe('min');
    expect(card.city).toBe('Prague');
    expect(card.caption).toBe('ahead of the sun');
  });

  it('flips the caption for a behind deviation', () => {
    const card = ogCardModel('Madrid', behind);
    expect(card.value).toBe('-11');
    expect(card.caption).toBe('behind the sun');
  });

  it('renders the in-sync edge with no unit and no caption', () => {
    const card = ogCardModel('Greenwich', synced);
    expect(card.value).toBe('In sync');
    expect(card.unit).toBe('');
    expect(card.caption).toBe('');
  });

  it('treats fractional deviations below 1 minute as in-sync (0.6 min)', () => {
    const rounded: Deviation = { ...ahead, total: 0.6, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', rounded);
    expect(card.value).toBe('In sync');
    expect(card.unit).toBe('');
    expect(card.caption).toBe('');
  });

  it('treats fractional deviations below 1 minute as in-sync (0.4 min)', () => {
    const rounded: Deviation = { ...ahead, total: 0.4, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', rounded);
    expect(card.value).toBe('In sync');
    expect(card.unit).toBe('');
    expect(card.caption).toBe('');
  });

  it('treats negative fractional deviations below 1 minute as in-sync (-0.6 min)', () => {
    const rounded: Deviation = { ...behind, total: -0.6, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', rounded);
    expect(card.value).toBe('In sync');
    expect(card.unit).toBe('');
    expect(card.caption).toBe('');
  });

  it('treats negative fractional deviations below 1 minute as in-sync (-0.4 min)', () => {
    const rounded: Deviation = { ...behind, total: -0.4, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', rounded);
    expect(card.value).toBe('In sync');
    expect(card.unit).toBe('');
    expect(card.caption).toBe('');
  });

  it('handles edge case at in-sync boundary (0.99 minutes → "In sync")', () => {
    const nearSync: Deviation = { ...synced, total: 0.99, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', nearSync);
    expect(card.value).toBe('In sync');
    expect(card.caption).toBe('');
  });

  it('handles edge case just above in-sync threshold (1.01 minutes → "+1")', () => {
    const justAbove: Deviation = { ...synced, total: 1.01, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', justAbove);
    expect(card.value).toBe('+1');
    expect(card.caption).toBe('ahead of the sun');
  });

  it('handles edge case at negative boundary (-0.99 minutes → "In sync")', () => {
    const nearSyncNeg: Deviation = { ...synced, total: -0.99, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', nearSyncNeg);
    expect(card.value).toBe('In sync');
    expect(card.caption).toBe('');
  });

  it('handles edge case just below negative threshold (-1.01 minutes → "-1")', () => {
    const justBelow: Deviation = { ...synced, total: -1.01, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', justBelow);
    expect(card.value).toBe('-1');
    expect(card.caption).toBe('behind the sun');
  });

  it('rounds large positive deviations correctly (+48.4 → "+48")', () => {
    const large: Deviation = { ...ahead, total: 48.4, solarNoon: 12 * 60 };
    const card = ogCardModel('Prague', large);
    expect(card.value).toBe('+48');
    expect(card.unit).toBe('min');
  });

  it('rounds large negative deviations correctly (-120.6 → "-121")', () => {
    const large: Deviation = { ...behind, total: -120.6, solarNoon: 11 * 60 };
    const card = ogCardModel('Prague', large);
    expect(card.value).toBe('-121');
    expect(card.unit).toBe('min');
  });

  it('preserves city name in card output', () => {
    const cities = ['Prague', 'Tokyo', 'New York', 'Sydney'];
    cities.forEach((cityName) => {
      const card = ogCardModel(cityName, ahead);
      expect(card.city).toBe(cityName);
    });
  });

  it('returns exact zero value as "0" (signed zero case)', () => {
    const zeroButNotInSync: Deviation = {
      ...synced,
      total: 0,
      solarNoon: 12 * 60,
    };
    const card = ogCardModel('Prague', zeroButNotInSync);
    // At exactly 0, isInSync returns true (|0| < 1)
    expect(card.value).toBe('In sync');
  });
});
