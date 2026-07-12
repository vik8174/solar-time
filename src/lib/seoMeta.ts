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
 * The brand OG card served at `/og/home.png` — the share preview for **every**
 * page (ADR D-019, amended by #131). One shared, numberless file: it never goes
 * stale (per-city cards baked DST + equation-of-time, so a July render was wrong
 * in January) and costs one render instead of ~1,000. No per-city OG cards.
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
  /** OG image path — always the brand card `/og/home.png` (D-019 / #131). */
  ogImagePath: string;
}

/**
 * Builds the SEO/share metadata for a city page.
 *
 * The `og:image` is **always** the shared brand card (`/og/home.png`, #131):
 * per-city cards baked the deviation number, which drifts with DST + the
 * equation of time, so the raster went stale between share and view. The
 * numberless brand card can't. `d` is still needed for the `<meta description>`,
 * which stays the build-date snapshot (D-003) — text, not a raster.
 *
 * @param city - City identity (display name + slug).
 * @param d - Clock-vs-sun deviation baked at build time (drives the description).
 * @returns Title, description, and site-relative canonical / OG image paths.
 */
export const seoMeta = (city: SeoCity, d: Deviation): SeoMeta => {
  const noon = formatClock(d.solarNoon);
  const description = isInSync(d.total)
    ? `In ${city.name}, your clock is in sync with the sun — real solar noon is at ${noon}. ` +
      `See how longitude, the equation of time, and daylight saving add up.`
    : buildDescription(city.name, d.total, noon);

  return {
    title: `Solar time in ${city.name}`,
    description,
    canonicalPath: `/${city.slug}`,
    ogImagePath: BRAND_OG_PATH,
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
