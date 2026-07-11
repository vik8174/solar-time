/**
 * ogPolicy — the single source of truth for "does this city get its own
 * per-city OG card?" (ADR D-019, amended by #90).
 *
 * Scaling the dataset to ~5,000 cities (#90) would, under the old "one satori
 * render per city" model, make OG generation dominate the build (~linear in the
 * city count — R-010). The fix decouples OG from page count: only the **top-K
 * cities by population** get a bespoke `/og/<slug>.png`; every other city's
 * `og:image` falls back to the existing brand card (`/og/home.png`). Build time
 * stays ~flat (top-K ≈ today's count), and no city loses a share preview.
 *
 * Both consumers — the OG endpoint (`og/[slug].png.ts`, which prerenders only
 * these slugs) and the per-page metadata (`seoMeta.ts`, which decides each
 * page's `og:image`) — MUST derive membership from this one helper. If they
 * disagreed, a page would point at a `/og/<slug>.png` that was never rendered
 * (404) or the build would render cards no page references (waste). Keeping the
 * selection here, pure and tested, is what keeps them in lockstep.
 */

import type { City } from '../data/cities';

/** The minimal city shape needed to rank for OG selection. */
export type OgRankable = Pick<City, 'slug' | 'population'>;

/**
 * Default per-city OG cap — the top ~1,000 by population keep a bespoke card,
 * matching the pre-#90 coverage so nothing regresses.
 */
export const DEFAULT_OG_TOP_K = 1000;

/**
 * Selects the slugs of the top-`k` cities by population that get a bespoke
 * per-city OG card.
 *
 * Deterministic: population descending, then **slug ascending** as the
 * tie-breaker, so the selection is byte-stable across builds regardless of the
 * input order (the shipped `City[]` carries no `geonameId`, so slug is the
 * stable secondary key). A non-positive `k` selects nothing.
 *
 * @param cities - The city registry (any order).
 * @param k - How many top-population cities keep a per-city card.
 * @returns The set of slugs that render their own `/og/<slug>.png`.
 */
export const topOgCitySlugs = (
  cities: readonly OgRankable[],
  k: number = DEFAULT_OG_TOP_K,
): ReadonlySet<string> => {
  const ranked = [...cities].sort(
    (a, b) => b.population - a.population || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
  return new Set(ranked.slice(0, Math.max(0, k)).map((city) => city.slug));
};
