/**
 * /og/<slug>.png — the per-city Open Graph card, generated at build (ADR D-018).
 *
 * Prerendered one PNG per city: the same `computeDeviation` → `ogCardModel` SSOT
 * as the page (R-001) feeds the pure card model, and `renderCityCard` (satori +
 * resvg, the I/O boundary) rasterizes it to 1200×630. `Base.astro` points each
 * city page's `og:image` here, so a shared link unfurls into the number + name.
 *
 * The number is the build-date snapshot (D-003): a raster can't recompute for
 * today the way the page's inline script does, which is the accepted trade-off
 * of static OG.
 */
import type { APIRoute, GetStaticPaths } from 'astro';

import { CITIES, getCity } from '../../data/cities';
import { computeDeviation } from '../../domain/solarTime';
import { ogCardModel } from '../../lib/ogCard';
import { renderCityCard } from '../../og/renderOgCard';

export const prerender = true;

export const getStaticPaths = (() =>
  CITIES.map((city) => ({ params: { slug: city.slug } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const city = params.slug ? getCity(params.slug) : undefined;
  if (!city) return new Response('Not found', { status: 404 });

  const deviation = computeDeviation({
    longitude: city.longitude,
    timeZone: city.timeZone,
    date: new Date(),
  });
  const png = await renderCityCard(ogCardModel(city.name, deviation));

  // Static output: Firebase serves the built file, so caching headers live in
  // firebase.json — only the content type matters here.
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
