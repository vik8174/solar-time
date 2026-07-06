/**
 * /og/home.png — the brand OG card for the live home page (`/`).
 *
 * `/` is per-visitor and noindex (D-005), so it has no fixed number to show; its
 * share preview is a static branded card (wordmark + tagline) instead of a
 * per-city number card. Static route — wins over `[slug].png` for this name.
 */
import type { APIRoute } from 'astro';

import { renderBrandCard } from '../../og/renderOgCard';

export const prerender = true;

export const GET: APIRoute = async () => {
  const png = await renderBrandCard('Solar Time', 'How far your clock is from the sun');
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
