import { describe, expect, it } from 'vitest';

import { apportionMinutes } from './apportionMinutes';

/**
 * apportionMinutes rounds additive components so the rounded parts sum exactly
 * to the rounded total (largest-remainder / Hamilton). These tests pin the
 * invariant "parts sum to total" across signs and rounding boundaries.
 */
describe('apportionMinutes', () => {
  it('leaves already-consistent roundings untouched', () => {
    // 2.25 + 4.04 + 60 = 66.29 → parts [2,4,60] already sum to round(66.29)=66.
    expect(apportionMinutes([2.25, 4.04, 60])).toEqual([2, 4, 60]);
  });

  it('reconciles parts that independently round below the total (Prague bug)', () => {
    // Independent: round each → 2+4+60 = 66, but round(67.2) = 67. One part must
    // absorb the leftover so the shown parts sum to the shown total.
    const parts = apportionMinutes([2.4, 4.4, 60.4]);
    expect(sum(parts)).toBe(67);
  });

  it('reconciles parts that independently round above the total', () => {
    // Independent: round each → 1+1+1 = 3, but round(0.6+0.6+0.6)=round(1.8)=2.
    const parts = apportionMinutes([0.6, 0.6, 0.6]);
    expect(sum(parts)).toBe(2);
  });

  it('handles negative components (signed apportionment)', () => {
    const parts = apportionMinutes([-2.6, -0.6, -0.6]);
    expect(sum(parts)).toBe(Math.round(-2.6 - 0.6 - 0.6));
  });

  it('handles a mix of positive and negative components', () => {
    const parts = apportionMinutes([-3.4, 5.4, 0.4]);
    expect(sum(parts)).toBe(Math.round(-3.4 + 5.4 + 0.4));
  });

  it('always makes the parts sum to the rounded total across a swept range', () => {
    for (let lon = -6; lon <= 6; lon += 0.5) {
      for (let eot = -4; eot <= 4; eot += 0.5) {
        for (const dst of [0, 30, 60]) {
          const parts = apportionMinutes([lon, eot, dst]);
          expect(sum(parts)).toBe(Math.round(lon + eot + dst) + 0);
        }
      }
    }
  });

  it('keeps each rounded part within one minute of its raw value', () => {
    const raw = [2.4, 4.4, 60.4];
    const parts = apportionMinutes(raw);
    raw.forEach((r, i) => {
      expect(Math.abs((parts[i] ?? NaN) - r)).toBeLessThanOrEqual(1);
    });
  });

  it('rounds a single component to itself', () => {
    expect(apportionMinutes([4.4])).toEqual([4]);
  });

  it('returns an empty array unchanged', () => {
    expect(apportionMinutes([])).toEqual([]);
  });
});

/** Sum a list of numbers. */
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
