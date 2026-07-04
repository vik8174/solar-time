import { describe, expect, it } from 'vitest';

import { scaleGeometry } from './scaleGeometry';
import { scaleInnerSvg } from './scaleSvg';

/**
 * scaleInnerSvg is the shared render used verbatim at build (`set:html`) and on
 * the client (`innerHTML`). These lock the geometry→markup contract so the two
 * can never drift — especially the off-by-one where the ideal-noon tick must be
 * drawn once (as the bright reference), not also in the generic tick loop.
 */
describe('scaleInnerSvg', () => {
  const g = scaleGeometry(66);
  const svg = scaleInnerSvg(g);
  const round = (v: number): number => Math.round(v * 100) / 100;

  it('places the accent marker at the geometry marker position', () => {
    expect(svg).toContain(`cx="${round(g.marker.x)}"`);
    expect(svg).toContain('fill:var(--accent)');
  });

  it('draws the ideal-noon reference exactly once (not duplicated by the tick loop)', () => {
    expect(svg).toContain('☉');
    expect(svg.match(/12:00/g)).toHaveLength(1);
  });

  it('labels the on-the-hour ticks', () => {
    expect(svg).toContain('11:00');
    expect(svg).toContain('13:00');
  });

  it('renders one tick line per non-ideal tick', () => {
    const tickLines = svg.match(/stroke:var\(--axis\);stroke-width:1"/g) ?? [];
    const expected = g.ticks.filter((t) => t.offset !== 0).length;
    expect(tickLines).toHaveLength(expected);
  });

  it('spans the axis across the full plot width', () => {
    expect(svg).toContain(`x1="${round(g.plotMinX)}"`);
    expect(svg).toContain(`x2="${round(g.plotMaxX)}"`);
  });
});
