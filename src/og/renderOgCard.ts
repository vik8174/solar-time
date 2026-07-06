/**
 * renderOgCard — the I/O boundary that rasterizes an OG card to a PNG buffer.
 *
 * satori lays out a small flexbox VDOM into SVG, then resvg rasterizes it to a
 * 1200×630 PNG (the Open Graph standard). This module is deliberately outside
 * `src/lib` (the D-012 coverage gate): it is a thin, side-effecting adapter over
 * two native libraries. The *content* it draws comes from the pure, tested
 * `ogCardModel` (SSOT for the number); this file owns only layout + fonts.
 *
 * Card palette mirrors the dark theme in `tokens.css` (D-006) — OG previews are
 * shown on the messenger's own chrome regardless of the viewer's colour scheme,
 * so the card is always the warm-dark brand look. The values are duplicated here
 * because satori cannot read CSS custom properties; `tokens.css` stays the SSOT
 * for the live UI.
 *
 * @see ADR D-018 (OG generation).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import satori, { type Font } from 'satori';

import type { OgCardModel } from '../lib/ogCard';

const WIDTH = 1200;
const HEIGHT = 630;

// Dark-theme brand colours (see tokens.css / D-006).
const COLOR = {
  bg: '#0d0d0d',
  text: '#f5f0e8',
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

/** Number font size shrinks as the value gets longer so it never overflows. */
const valueFontSize = (value: string): number => {
  if (value.length <= 4) return 240;
  if (value.length <= 6) return 170;
  return 130;
};

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
        'SOLAR TIME',
      ),
      ...children,
    ],
  );

/** Builds the city-card VDOM (number + unit, city name, direction caption). */
const cityCard = (model: OgCardModel): Node =>
  frame([
    el('div', { display: 'flex', alignItems: 'baseline', color: COLOR.accent }, [
      el(
        'div',
        { fontSize: `${String(valueFontSize(model.value))}px`, fontWeight: 700 },
        model.value,
      ),
      ...(model.unit
        ? [el('div', { fontSize: '84px', marginLeft: '20px', color: COLOR.muted }, model.unit)]
        : []),
    ]),
    el(
      'div',
      {
        display: 'flex',
        maxWidth: '1000px',
        fontSize: '56px',
        color: COLOR.text,
        marginTop: '24px',
        textAlign: 'center',
      },
      model.city,
    ),
    ...(model.caption
      ? [el('div', { fontSize: '32px', color: COLOR.muted, marginTop: '16px' }, model.caption)]
      : []),
  ]);

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
  // JUSTIFIED: satori's first arg is typed as its own JSX `ReactNode`; our
  // minimal hand-rolled `Node` VDOM is structurally what satori consumes at
  // runtime but is not nominally that type, and we avoid a JSX runtime on
  // purpose (see the `Node` interface above). `as never` opts this one call out.
  const svg = await satori(node as never, { width: WIDTH, height: HEIGHT, fonts });
  const raw = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  // Copy into a fresh ArrayBuffer-backed Uint8Array: resvg returns a Node Buffer
  // (`Uint8Array<ArrayBufferLike>`), which strictest TS won't accept as the DOM
  // `BodyInit` the endpoints' `Response` expects — only `<ArrayBuffer>` fits.
  const bytes = new Uint8Array(raw.length);
  bytes.set(raw);
  return bytes;
};

/**
 * Renders a per-city OG card to a PNG buffer.
 *
 * If the per-city card can't be laid out (e.g. a future dataset name with glyphs
 * the bundled font lacks), it degrades to the brand card — content that has no
 * city-specific input — so one bad city never breaks the whole build. A
 * *systemic* failure (font missing, resvg broken) still throws from the brand
 * render, which is correct: that should fail the build loudly, not ship 1000
 * blank cards (fail-fast).
 *
 * @param model - Pure card text model (from `ogCardModel`).
 * @returns PNG bytes for `/og/<slug>.png`.
 */
export const renderCityCard = async (model: OgCardModel): Promise<Uint8Array<ArrayBuffer>> => {
  try {
    return await toPng(cityCard(model));
  } catch (error) {
    console.warn(`og: city card fell back to the brand card for "${model.city}"`, error);
    return toPng(brandCard('Solar Time', 'How far your clock is from the sun'));
  }
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
