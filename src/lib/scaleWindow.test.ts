import { describe, expect, it } from 'vitest';

import { scaleWindow } from './scaleWindow';

/**
 * scaleWindow — behavioural contract for the solar-noon scale.
 *
 * Input is the signed total deviation in minutes (marker sits at `total`
 * offset from ideal noon = 0). Output is a symmetric, round-bounded window
 * with a constant tick step, sized so the marker never touches the edge.
 */
describe('scaleWindow', () => {
  it('is symmetric around ideal noon (0)', () => {
    const w = scaleWindow(66);
    expect(w.min).toBe(-w.max);
  });

  it('keeps the marker strictly inside the window with margin', () => {
    for (const total of [0, 12, 48, 66, -66, 150, -180]) {
      const { max } = scaleWindow(total);
      // marker at |total| must sit within 85% of the half-span (never at the edge)
      expect(Math.abs(total)).toBeLessThanOrEqual(max * 0.85);
    }
  });

  it('picks the tightest round window that still fits the marker', () => {
    // Prague (+66) fits in a ±90 window, not the looser ±120
    expect(scaleWindow(66).max).toBe(90);
    // a near-meridian city (+12) collapses to the tightest ±30
    expect(scaleWindow(12).max).toBe(30);
  });

  it('uses a constant tick step that evenly divides the half-span', () => {
    const { max, step } = scaleWindow(66);
    expect(max % step).toBe(0);
    expect(step).toBeGreaterThan(0);
  });

  it('emits evenly spaced ticks including 0 and both bounds', () => {
    const { min, max, step, ticks } = scaleWindow(66);
    expect(ticks[0]).toBe(min);
    expect(ticks[ticks.length - 1]).toBe(max);
    expect(ticks).toContain(0);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i] - ticks[i - 1]).toBe(step);
    }
  });

  it('treats a zero deviation as valid and centered', () => {
    const w = scaleWindow(0);
    expect(w.min).toBe(-w.max);
    expect(w.ticks).toContain(0);
  });

  it('is sign-agnostic — the window depends only on magnitude', () => {
    expect(scaleWindow(66)).toEqual(scaleWindow(-66));
  });

  it('expands the window for large deviations (western China, Spain)', () => {
    expect(scaleWindow(176).max).toBeGreaterThanOrEqual(200);
    expect(Math.abs(176)).toBeLessThanOrEqual(scaleWindow(176).max * 0.85);
  });

  it('falls back to the widest window for extreme (unphysical) deviations', () => {
    const w = scaleWindow(620);
    expect(w.max).toBe(720);
    // beyond the ladder the comfort margin can be exceeded, but the marker
    // must still land strictly inside the axis rather than off the end.
    expect(Math.abs(620)).toBeLessThan(w.max);
    expect(w.ticks).toContain(0);
  });
});
