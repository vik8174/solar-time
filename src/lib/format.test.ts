import { describe, expect, it } from 'vitest';

import { formatClock, isInSync, signedMinutes } from './format';

/**
 * Display rules (SSOT) for the city page — the edge cases from the PRD live
 * here as pure functions so components stay presentational.
 */
describe('signedMinutes', () => {
  it('prefixes a positive value with "+" and rounds to whole minutes', () => {
    expect(signedMinutes(66.29)).toBe('+66');
    expect(signedMinutes(4.04)).toBe('+4');
  });

  it('prefixes a negative value with "-" and rounds by magnitude', () => {
    expect(signedMinutes(-10.87)).toBe('-11');
  });

  it('renders an exact-zero component without a sign', () => {
    expect(signedMinutes(0)).toBe('0');
    expect(signedMinutes(0.2)).toBe('0');
  });
});

describe('formatClock', () => {
  it('formats minutes-from-midnight as zero-padded HH:MM', () => {
    expect(formatClock(786.29)).toBe('13:06');
    expect(formatClock(730.88)).toBe('12:11');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatClock(545)).toBe('09:05');
  });

  it('rounds to the nearest minute without spilling to :60', () => {
    expect(formatClock(779.6)).toBe('13:00');
  });
});

describe('isInSync', () => {
  it('is true when the clock is within a minute of the sun', () => {
    expect(isInSync(0)).toBe(true);
    expect(isInSync(0.9)).toBe(true);
    expect(isInSync(-0.5)).toBe(true);
  });

  it('is false once the deviation reaches a full minute', () => {
    expect(isInSync(1)).toBe(false);
    expect(isInSync(66)).toBe(false);
  });
});
