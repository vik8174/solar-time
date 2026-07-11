/**
 * build-favicons — bakes the Solar Drift favicon / icon set from the brand mark
 * SSOT (issue #89).
 *
 * MANUAL, never CI (like `build:cities`): CI runs `npm run build`, which serves
 * the committed static assets in `public/`. Regenerate and commit the output
 * whenever the mark in `src/lib/brandMark.ts` changes:
 *
 *   npm run build:favicons
 *
 * The mark's geometry and colours live in `src/lib/brandMark.ts` — this file
 * only rasterises that one source into every format a browser / OS asks for.
 * `@resvg/resvg-js` (already a dependency, used for OG cards) does SVG→PNG;
 * `png-to-ico` (exact devDep added for #89) packs the multi-size `.ico`.
 *
 * Outputs (all written to `public/`):
 *   - favicon.svg          the rounded badge, source of truth for the tab icon
 *   - favicon.ico          16/32/48 multi-size, from the rounded badge
 *   - apple-touch-icon.png 180×180, opaque full-bleed square (iOS masks it)
 *   - icon-192.png         PWA manifest icon (rounded badge)
 *   - icon-512.png         PWA manifest icon (rounded badge)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

import { brandMarkSvg } from '../src/lib/brandMark';

const PUBLIC_DIR = join(process.cwd(), 'public');

/** The rounded badge (transparent corners) — favicon, header, PWA "any" icons. */
const ROUNDED_SVG = brandMarkSvg({ cornerRadius: 26 });

/** Full-bleed opaque square — apple-touch (iOS composites transparency on black). */
const SQUARE_SVG = brandMarkSvg({ cornerRadius: 0 });

/** Rasterise an SVG string to PNG bytes at an exact square size. */
const rasterize = (svg: string, size: number): Buffer =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());

const write = (name: string, data: Buffer | string): void => {
  writeFileSync(join(PUBLIC_DIR, name), data);
  console.log(`  wrote public/${name}`);
};

const main = async (): Promise<void> => {
  console.log('Baking Solar Drift favicon set from src/lib/brandMark.ts …');

  // Vector tab icon — the source of truth browsers prefer.
  write('favicon.svg', `${ROUNDED_SVG}\n`);

  // Multi-size .ico from the rounded badge (16/32/48 — the classic favicon set).
  const icoSizes = [16, 32, 48];
  const ico = await pngToIco(icoSizes.map((size) => rasterize(ROUNDED_SVG, size)));
  write('favicon.ico', ico);

  // apple-touch: 180×180, opaque square so iOS can round it without a black halo.
  write('apple-touch-icon.png', rasterize(SQUARE_SVG, 180));

  // PWA manifest icons (purpose "any") — the rounded badge, matching the tab.
  write('icon-192.png', rasterize(ROUNDED_SVG, 192));
  write('icon-512.png', rasterize(ROUNDED_SVG, 512));

  console.log('Done.');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
