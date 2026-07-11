/**
 * brandMark — the single source of truth for the Solar Drift brand mark
 * (issue #89, Concept C "sundial").
 *
 * The mark is a gold sundial — a ring with a hand pointing just off noon to a
 * sun dot — sitting on a dark rounded tile. One shape is reused everywhere so
 * the identity is consistent: `public/favicon.svg`, the icon beside the header
 * wordmark (`Base.astro`), and the whole raster set baked by
 * `scripts/build-favicons.ts` (favicon.ico, apple-touch-icon, PWA PNGs).
 *
 * Why a tile instead of the previous monochrome `@media` fill swap: Concept C
 * is a single gold `#e8a923` mark. Gold on a transparent background goes muddy
 * on a light browser tab bar, so the mark carries its own dark tile — it reads
 * crisply on both light and dark chrome with no colour-scheme swap. The tile
 * colour (`--tile`) is intentionally a hair lighter than the site background so
 * the badge has a faint edge; the gold matches `--accent` / the OG card.
 *
 * Coordinates live on a 128 grid (the viewBox the owner authored the mark in).
 * Stroke weights are bumped from the source sketch so the ring and hand survive
 * rasterisation down to a 16px favicon.
 *
 * @see docs/DECISIONS.md (D-019 — one identity across favicon / header / OG).
 */

/** Gold used for every stroke and dot — mirrors `--accent` (dark theme). */
export const BRAND_GOLD = '#e8a923';

/** Dark tile behind the mark — a touch lighter than `--bg` for a faint edge. */
export const BRAND_TILE = '#141414';

/** viewBox side; the mark is authored on a 128×128 grid. */
export const BRAND_VIEWBOX = 128;

/**
 * The sundial mark itself (ring + hand + sun dot + centre dot), gold, no tile.
 * Bumped stroke weights (8 vs the source sketch's 3–4) keep the ring and hand
 * legible when the icon is rasterised down to 16px.
 */
export const BRAND_MARK_PATHS = [
  `<circle cx="64" cy="64" r="37" fill="none" stroke="${BRAND_GOLD}" stroke-width="9"/>`,
  `<line x1="64" y1="64" x2="90" y2="35" stroke="${BRAND_GOLD}" stroke-width="9" stroke-linecap="round"/>`,
  `<circle cx="90" cy="35" r="8.5" fill="${BRAND_GOLD}"/>`,
  `<circle cx="64" cy="64" r="5.5" fill="${BRAND_GOLD}"/>`,
].join('\n  ');

/**
 * Builds a complete brand-mark SVG document string: the dark tile plus the
 * sundial mark on the 128 viewBox.
 *
 * @param options.cornerRadius - Tile corner radius on the 128 grid. Use ~26 for
 *   the rounded badge (favicon, header, PWA "any" icons); use 0 for a full-bleed
 *   square tile (apple-touch-icon, which iOS masks and rounds itself — a
 *   pre-rounded, transparent-cornered icon would composite on black and look
 *   broken).
 * @returns A self-contained `<svg>` string with an opaque dark tile background.
 */
export const brandMarkSvg = ({ cornerRadius = 26 }: { cornerRadius?: number } = {}): string =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(BRAND_VIEWBOX)} ${String(BRAND_VIEWBOX)}">`,
    `  <rect width="${String(BRAND_VIEWBOX)}" height="${String(BRAND_VIEWBOX)}" rx="${String(cornerRadius)}" fill="${BRAND_TILE}"/>`,
    `  ${BRAND_MARK_PATHS}`,
    `</svg>`,
  ].join('\n');
