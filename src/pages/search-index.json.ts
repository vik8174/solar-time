/**
 * /search-index.json — the lean, statically-generated search payload.
 *
 * Prerendered to a static file at build time; the `CitySearch` island fetches
 * it lazily (on idle) and builds the Fuse index client-side. Emitting it as a
 * cacheable endpoint (rather than inlining into every page's HTML) keeps it out
 * of the initial document and lets the browser reuse it across navigations.
 * Shape is `{ slug, name, altNames }[]` — see `toSearchIndex` / ADR D-016.
 */
import type { APIRoute } from 'astro';

import { CITIES } from '../data/cities';
import { toSearchIndex } from '../lib/searchIndex';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(toSearchIndex(CITIES)), {
    headers: { 'Content-Type': 'application/json' },
  });
