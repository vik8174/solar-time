/**
 * /tz-index.json — the lean timezone→city payload for the search geo fallback.
 *
 * Prerendered to a static file; fetched by the `CitySearch` island *only* when
 * the user hits "use my location" on an empty result, then fed to
 * `resolveDefaultCity`. Kept separate from the search index so neither payload
 * carries fields the other doesn't need. Shape is
 * `{ slug, timeZone, population }[]` — see `toTzIndex` / ADR D-016.
 */
import type { APIRoute } from 'astro';

import { CITIES } from '../data/cities';
import { toTzIndex } from '../lib/tzIndex';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(toTzIndex(CITIES)), {
    headers: { 'Content-Type': 'application/json' },
  });
