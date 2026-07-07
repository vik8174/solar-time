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

/**
 * Analytics/monitoring environment tag for the current build target (D-008).
 *
 * Derived from the same build-time `SITE_ENV` flag as everything else here, so
 * it is Node-only and never in the client bundle. The client SDKs run in the
 * browser, so this value is handed to them via a `data-*` attribute on the page
 * shell (`Base.astro`), not read on the client directly — while the SDK *keys*
 * reach the browser through `import.meta.env.PUBLIC_*`. Sentry stamps every
 * event with this tag to keep stage and prod errors apart.
 */
export const ANALYTICS_ENV = IS_PROD ? 'production' : 'staging';
