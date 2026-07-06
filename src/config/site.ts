/**
 * site — build-time environment split (ADR D-020).
 *
 * A single `SITE_ENV` flag distinguishes the two Firebase targets (D-002):
 * `deploy:prod` runs `SITE_ENV=prod npm run build`; every other build (local,
 * CI, stage preview) leaves it unset and is treated as stage. The flag drives
 * three things: the `site` URL (canonical + absolute OG URLs + sitemap), the
 * sitemap gating (prod only), and the robots / per-page `noindex` policy —
 * stage is `Disallow: /` + noindex everywhere, prod is indexable (except `/`,
 * which stays noindex per D-005).
 *
 * `process.env` is read at build time only (Node): this module is imported from
 * `astro.config`, `.astro` frontmatter, and build endpoints — never from a
 * client `<script>` island — so the flag never reaches the browser bundle.
 *
 * `site` defaults to the Firebase-provided prod hostname (D-c); swapping in a
 * custom domain later is a one-line change here (R-006).
 */

const PROD_URL = 'https://solar-time-prod.web.app';
const STAGE_URL = 'https://solar-time-stage.web.app';

/** True only for a `SITE_ENV=prod` build (the manual `deploy:prod`). */
export const IS_PROD = process.env.SITE_ENV === 'prod';

/** Absolute site origin for the current build target (no trailing slash). */
export const SITE_URL = IS_PROD ? PROD_URL : STAGE_URL;
