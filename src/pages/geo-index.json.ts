/**
 * /geo-index.json — the lean geo payload for the live home page (`/`).
 *
 * Prerendered to a static file; fetched by the home island *only* when the
 * visitor asks for their location (and to render the timezone default), then
 * fed to `findNearestCity` / rendered directly. Kept separate from the search
 * and tz indexes so neither payload carries fields the other doesn't need.
 * Shape is `{ slug, name, lat, lon }[]` — see `toGeoIndex` / ADR D-016.
 */
import type { APIRoute } from 'astro';

import { CITIES } from '../data/cities';
import { toGeoIndex } from '../lib/geoIndex';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(toGeoIndex(CITIES)), {
    headers: { 'Content-Type': 'application/json' },
  });
