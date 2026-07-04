/**
 * scaleSvg — renders the inner markup of the solar-noon scale from geometry.
 * Pure string builder with no framework binding, injected identically at build
 * (Astro `set:html`) and on the client (`innerHTML`) so the two never diverge.
 * Colours come from CSS custom properties, so it themes with the page.
 */

import type { ScaleGeometry } from './scaleGeometry';

/** Rounds to at most 2 decimals to keep the emitted SVG compact. */
const n = (value: number): number => Math.round(value * 100) / 100;

/**
 * Builds the inner SVG elements (axis, ticks, ideal reference, marker).
 *
 * @param g - Precomputed scale geometry.
 * @returns SVG markup to place inside a `<svg>` with `g`'s viewBox.
 */
export const scaleInnerSvg = (g: ScaleGeometry): string => {
  const parts: string[] = [
    `<line x1="${n(g.plotMinX)}" y1="${g.axisY}" x2="${n(g.plotMaxX)}" y2="${g.axisY}" style="stroke:var(--axis);stroke-width:1.5" />`,
  ];

  for (const t of g.ticks) {
    if (t.offset === 0) continue; // ideal noon is drawn as the bright reference below
    const h = t.major ? 7 : 5;
    parts.push(
      `<line x1="${n(t.x)}" y1="${g.axisY - h}" x2="${n(t.x)}" y2="${g.axisY + h}" style="stroke:var(--axis);stroke-width:1" />`,
    );
    if (t.major) {
      parts.push(
        `<text x="${n(t.x)}" y="${g.axisY + 30}" text-anchor="middle" style="fill:var(--muted-dim);font-family:var(--mono);font-size:10px">${t.label}</text>`,
      );
    }
  }

  const ix = n(g.ideal.x);
  parts.push(
    `<line x1="${ix}" y1="${g.axisY - 14}" x2="${ix}" y2="${g.axisY + 14}" style="stroke:var(--text);stroke-width:1.5;opacity:0.5" />`,
    `<text x="${ix}" y="${g.axisY - 24}" text-anchor="middle" style="fill:var(--text);font-family:var(--mono);font-size:13px;opacity:0.85">☉</text>`,
    `<text x="${ix}" y="${g.axisY + 30}" text-anchor="middle" style="fill:var(--muted);font-family:var(--mono);font-size:11px">12:00</text>`,
  );

  const mx = n(g.marker.x);
  parts.push(
    `<circle cx="${mx}" cy="${g.axisY}" r="13" style="fill:none;stroke:var(--accent);stroke-width:1;opacity:0.35" />`,
    `<circle cx="${mx}" cy="${g.axisY}" r="7" style="fill:var(--accent)" />`,
  );

  return parts.join('');
};
