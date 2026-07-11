/**
 * seoMeta — pure view model for a city page's SEO + share metadata.
 *
 * Turns a city identity + its build-time `Deviation` into the strings the
 * `<head>` needs: `<title>`, `<meta name="description">`, the canonical path,
 * and the Open Graph image path. Kept pure (no `Astro.site`, no I/O) so it is
 * unit-tested under the D-012 gate; `Base.astro` absolutizes the paths against
 * `Astro.site` at render time.
 *
 * The number is the build-date snapshot (D-003): the page recomputes for today
 * client-side, but crawlers read this baked description — deterministic given
 * the build instant, and the ±1-minute drift over a build's lifetime is
 * acceptable for SEO. The volatile number lives only in the description; the
 * title stays evergreen for keyword matching ("solar time {city}", story 14).
 *
 * NOTE: "Solar time in {city}" is the physics/SEO keyword phrase, not the
 * "Solar Drift" brand wordmark — it is intentionally excluded from the brand
 * rename (#94), like "apparent/mean/true solar time" elsewhere. Do not rename.
 */

import type { Deviation } from '../domain/solarTime';
import { formatClock, isInSync } from './format';

/**
 * The brand OG card served at `/og/home.png` — the share preview for every city
 * outside the per-city OG top-K (ADR D-019, amended by #90). One shared file,
 * not a per-city render; see {@link topOgCitySlugs} in `ogPolicy.ts` for the SSOT
 * that decides membership.
 */
const BRAND_OG_PATH = '/og/home.png';

/** Static identity of the city being described. */
export interface SeoCity {
  name: string;
  /** URL slug — drives the canonical and OG image paths. */
  slug: string;
}

/** Ready-to-render SEO strings; paths are site-relative (absolutized upstream). */
export interface SeoMeta {
  /** `<title>` / og:title — evergreen, keyword-matched. */
  title: string;
  /** `<meta name="description">` / og:description. */
  description: string;
  /** Canonical path, e.g. `/prague`. */
  canonicalPath: string;
  /** OG image path, e.g. `/og/prague.png`. */
  ogImagePath: string;
}

/**
 * Builds the SEO/share metadata for a city page.
 *
 * @param city - City identity (display name + slug).
 * @param d - Clock-vs-sun deviation baked at build time.
 * @param hasOwnOgCard - Whether this city is in the per-city OG top-K (D-019 /
 *   #90). `true` → its bespoke `/og/<slug>.png`; `false` → the shared brand card
 *   (`/og/home.png`). The caller derives this from `topOgCitySlugs` (the SSOT),
 *   so this module never sees the whole registry and stays trivially testable.
 * @returns Title, description, and site-relative canonical / OG image paths.
 */
export const seoMeta = (city: SeoCity, d: Deviation, hasOwnOgCard: boolean): SeoMeta => {
  const noon = formatClock(d.solarNoon);
  const description = isInSync(d.total)
    ? `In ${city.name}, your clock is in sync with the sun — real solar noon is at ${noon}. ` +
      `See how longitude, the equation of time, and daylight saving add up.`
    : buildDescription(city.name, d.total, noon);

  return {
    title: `Solar time in ${city.name}`,
    description,
    canonicalPath: `/${city.slug}`,
    ogImagePath: hasOwnOgCard ? `/og/${city.slug}.png` : BRAND_OG_PATH,
  };
};

/** Description for a non-synced city: magnitude + direction + solar noon. */
const buildDescription = (name: string, total: number, noon: string): string => {
  const magnitude = Math.abs(Math.round(total));
  const unit = magnitude === 1 ? 'minute' : 'minutes';
  const direction = total > 0 ? 'ahead of' : 'behind';
  return (
    `In ${name}, the clock runs ${magnitude} ${unit} ${direction} the sun. ` +
    `Real solar noon is at ${noon}. ` +
    `See the breakdown: longitude, equation of time, and daylight saving.`
  );
};
