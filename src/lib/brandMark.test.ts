import { describe, expect, it } from 'vitest';

import { BRAND_GOLD, BRAND_MARK_PATHS, BRAND_TILE, BRAND_VIEWBOX, brandMarkSvg } from './brandMark';

describe('brandMark', () => {
  it('draws the four sundial elements in gold', () => {
    // ring + hand + sun dot + centre dot — the recognisable Concept C shape.
    expect(BRAND_MARK_PATHS).toContain('<circle cx="64" cy="64" r="37"');
    expect(BRAND_MARK_PATHS).toContain('<line');
    expect(BRAND_MARK_PATHS.match(/<circle/g)).toHaveLength(3);
    expect(BRAND_MARK_PATHS).not.toContain('#000');
    expect(BRAND_MARK_PATHS.split(BRAND_GOLD).length - 1).toBe(4);
  });

  it('wraps the mark in a dark tile on the 128 viewBox by default (rounded)', () => {
    const svg = brandMarkSvg();
    expect(svg).toContain(`viewBox="0 0 ${String(BRAND_VIEWBOX)} ${String(BRAND_VIEWBOX)}"`);
    expect(svg).toContain(`fill="${BRAND_TILE}"`);
    expect(svg).toContain('rx="26"');
    expect(svg).toContain(BRAND_MARK_PATHS);
  });

  it('emits a full-bleed square tile when cornerRadius is 0 (apple-touch)', () => {
    expect(brandMarkSvg({ cornerRadius: 0 })).toContain('rx="0"');
  });
});
