// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import { IS_PROD, SITE_URL } from './src/config/site.ts';

// https://astro.build/config
export default defineConfig({
  // Canonical URLs, absolute OG image URLs, and the sitemap all need `site`.
  // It follows the build target (ADR D-019): prod host on `SITE_ENV=prod`,
  // stage host otherwise (see src/config/site.ts).
  site: SITE_URL,
  // Firebase serves with `cleanUrls: true` + `trailingSlash: false`, and the
  // canonical/OG URLs are slash-less (`/prague`). Make Astro agree so the
  // sitemap emits `/prague` too — no redirect hop, no canonical mismatch.
  trailingSlash: 'never',
  // Hover-prefetch links marked `data-astro-prefetch` (search results) so a
  // selection navigates instantly; paired with `<ClientRouter />` for View
  // Transitions. See slice #6 / ADR D-016.
  prefetch: { defaultStrategy: 'hover' },
  integrations: [
    react(),
    // Sitemap is prod-only (D-019). Exclude the noindex home (`/`, D-005) and
    // the non-page endpoints (anything with a file extension: *.png/*.json/etc).
    ...(IS_PROD
      ? [
          sitemap({
            filter: (page) => {
              const path = new URL(page).pathname;
              return path !== '/' && !/\.[a-z0-9]+$/i.test(path);
            },
          }),
        ]
      : []),
  ],
});
