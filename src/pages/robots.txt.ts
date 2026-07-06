/**
 * /robots.txt — environment-driven crawl policy (ADR D-020).
 *
 * Replaces the old static `public/robots.txt` (which was `Disallow: /` for
 * every target). Stage stays fully disallowed; prod is crawlable and points at
 * the sitemap. `/` is kept out of the index by its `noindex` meta (D-005), NOT
 * by a robots disallow — a disallow would stop Google from ever seeing that
 * meta, so prod robots intentionally allows all.
 */
import type { APIRoute } from 'astro';

import { IS_PROD, SITE_URL } from '../config/site';

export const prerender = true;

export const GET: APIRoute = () => {
  const body = IS_PROD
    ? `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap-index.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
