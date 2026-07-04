import { describe, expect, it } from 'vitest';

import { scaleGeometry } from './scaleGeometry';

/**
 * scaleGeometry — pure pixel mapping for the solar-noon SVG. Shared by the
 * build-time render and the client recompute so both draw identical geometry.
 */
describe('scaleGeometry', () => {
  it('places ideal noon at the horizontal center of the plot', () => {
    const g = scaleGeometry(66);
    expect(g.ideal.x).toBeCloseTo((g.plotMinX + g.plotMaxX) / 2);
  });

  it('keeps the marker inside the plot area', () => {
    for (const total of [0, 66, -66, 176, -180]) {
      const g = scaleGeometry(total);
      expect(g.marker.x).toBeGreaterThan(g.plotMinX);
      expect(g.marker.x).toBeLessThan(g.plotMaxX);
    }
  });

  it('maps a larger deviation to a marker further from center', () => {
    const center = scaleGeometry(0).marker.x;
    const small = scaleGeometry(30).marker.x;
    const large = scaleGeometry(80).marker.x;
    expect(small).toBeGreaterThan(center);
    expect(large).toBeGreaterThan(small);
  });

  it('mirrors positive and negative deviations across the center', () => {
    const g = scaleGeometry(66);
    const mirror = scaleGeometry(-66);
    expect(g.marker.x + mirror.marker.x).toBeCloseTo(g.plotMinX + g.plotMaxX);
  });

  it('labels the on-the-hour ticks with clock times, including 12:00 at center', () => {
    const noon = scaleGeometry(66).ticks.find((t) => t.offset === 0);
    expect(noon).toBeDefined();
    expect(noon?.major).toBe(true);
    expect(noon?.label).toBe('12:00');
    const plusHour = scaleGeometry(66).ticks.find((t) => t.offset === 60);
    expect(plusHour?.label).toBe('13:00');
  });

  it('marks half-hour ticks as minor (unlabeled on the hour test)', () => {
    const half = scaleGeometry(66).ticks.find((t) => t.offset === 30);
    expect(half?.major).toBe(false);
  });
});
