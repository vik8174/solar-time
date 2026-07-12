/**
 * renderOgCard — the I/O boundary that rasterizes the brand OG card to a PNG.
 *
 * satori lays out a small flexbox VDOM into SVG, then resvg rasterizes it to a
 * 1200×630 PNG (the Open Graph standard). This module is deliberately outside
 * `src/lib` (the D-012 coverage gate): it is a thin, side-effecting adapter over
 * two native libraries; it owns only layout + fonts.
 *
 * Every page's `og:image` is this one numberless brand card (`/og/home.png`,
 * #131) — per-city number cards were dropped because the baked number drifts
 * with DST + the equation of time, so a shared link unfurled a stale number.
 *
 * Card palette mirrors the dark theme in `tokens.css` (D-006) — OG previews are
 * shown on the messenger's own chrome regardless of the viewer's colour scheme,
 * so the card is always the warm-dark brand look. The values are duplicated here
 * because satori cannot read CSS custom properties; `tokens.css` stays the SSOT
 * for the live UI.
 *
 * @see ADR D-019 (OG generation, amended by #131).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import satori, { type Font } from 'satori';

const WIDTH = 1200;
const HEIGHT = 630;

// Dark-theme brand colours (see tokens.css / D-006).
const COLOR = {
  bg: '#0d0d0d',
  accent: '#e8a923',
  muted: '#8a8175',
} as const;

const FONT = 'JetBrains Mono';

// Resolve from the project root (cwd during `astro build`), not `import.meta.url`
// — this module is bundled into `dist/.prerender/`, so a path relative to the
// bundled file wouldn't find the fonts. Build-time only; never runs client-side.
const fontFile = (name: string): Buffer => readFileSync(join(process.cwd(), 'src/og/fonts', name));

// Loaded once per build process, reused across every card.
const fonts: Font[] = [
  { name: FONT, data: fontFile('JetBrainsMono-Regular.ttf'), weight: 400, style: 'normal' },
  { name: FONT, data: fontFile('JetBrainsMono-Bold.ttf'), weight: 700, style: 'normal' },
];

/** Minimal satori VDOM node (avoids pulling in a JSX runtime for a build script). */
interface Node {
  type: string;
  props: { style: Record<string, unknown>; children?: Node[] | string };
}

const el = (type: string, style: Record<string, unknown>, children?: Node[] | string): Node => ({
  type,
  props: children === undefined ? { style } : { style, children },
});

/** The shared page frame: dark canvas, brand wordmark, centred content. */
const frame = (children: Node[]): Node =>
  el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: COLOR.bg,
      fontFamily: FONT,
      padding: '72px',
      position: 'relative',
    },
    [
      el(
        'div',
        {
          position: 'absolute',
          top: '56px',
          left: '72px',
          fontSize: '28px',
          letterSpacing: '0.24em',
          color: COLOR.muted,
        },
        'SOLAR DRIFT',
      ),
      ...children,
    ],
  );

/** Builds the brand/home-card VDOM (wordmark + tagline, no per-city number). */
const brandCard = (title: string, subtitle: string): Node =>
  frame([
    el('div', { fontSize: '150px', fontWeight: 700, color: COLOR.accent }, title),
    el(
      'div',
      {
        display: 'flex',
        maxWidth: '1000px',
        fontSize: '40px',
        color: COLOR.muted,
        marginTop: '24px',
        textAlign: 'center',
      },
      subtitle,
    ),
  ]);

/** Rasterizes a satori VDOM to PNG bytes at OG dimensions. */
const toPng = async (node: Node): Promise<Uint8Array<ArrayBuffer>> => {
  // satori types its first arg as `ReactNode` (imported from `react`). With
  // React removed from the project (the island runs on Preact) that import
  // resolves to `any` under `skipLibCheck`, so our minimal hand-rolled
  // `Node` VDOM — deliberately not a JSX runtime (see the `Node` interface
  // above) — is accepted directly, with no cast needed.
  const svg = await satori(node, { width: WIDTH, height: HEIGHT, fonts });
  const raw = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  // Copy into a fresh ArrayBuffer-backed Uint8Array: resvg returns a Node Buffer
  // (`Uint8Array<ArrayBufferLike>`), which strictest TS won't accept as the DOM
  // `BodyInit` the endpoints' `Response` expects — only `<ArrayBuffer>` fits.
  const bytes = new Uint8Array(raw.length);
  bytes.set(raw);
  return bytes;
};

/**
 * Renders the brand/home OG card to a PNG buffer.
 *
 * @param title - Wordmark line.
 * @param subtitle - Tagline line.
 * @returns PNG bytes for `/og/home.png`.
 */
export const renderBrandCard = (
  title: string,
  subtitle: string,
): Promise<Uint8Array<ArrayBuffer>> => toPng(brandCard(title, subtitle));
