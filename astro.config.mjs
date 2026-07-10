// @ts-check
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

import { IS_PROD, SITE_URL } from './src/config/site.ts';

/** Absolute path of the directory holding this config — the project root. */
const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

/**
 * Extra directories the dev server is allowed to read from, or `undefined` to
 * leave Vite's default alone.
 *
 * A per-ticket worktree (`scripts/ticket-worktree.sh`, D-015) gets its
 * `node_modules` as a symlink to the primary clone. Vite's default
 * `resolve.preserveSymlinks: false` then resolves every dependency to its
 * *real* path — inside the primary clone — while `server.fs.allow` defaults to
 * the project root, i.e. the worktree. The real paths fall outside it, so the
 * dev server answers 403 and no island ever hydrates (#114).
 *
 * Widening `allow` to the symlink's target keeps the symlink (and the instant
 * `pre-push` it buys, #37) while letting the dev server serve those deps.
 *
 * @returns {string[] | undefined} Directories for `server.fs.allow`.
 */
function resolveFsAllow() {
  const nodeModules = resolve(PROJECT_ROOT, 'node_modules');

  // Fresh clone before `npm install` (or a dangling link): nothing to widen,
  // and `realpathSync` would throw. Leave Vite's default untouched.
  if (!existsSync(nodeModules)) return undefined;

  // Primary clone: `node_modules` is a real directory, so no dependency ever
  // resolves outside the project root and Vite's default already covers us.
  // Test the symlink directly — comparing `realpathSync(nodeModules)` against
  // `nodeModules` would also fire when merely an *ancestor* is a symlink
  // (e.g. a clone under macOS's `/tmp` -> `/private/tmp`).
  if (!lstatSync(nodeModules).isSymbolicLink()) return undefined;

  // `allow` REPLACES Vite's default rather than extending it, so the project
  // root has to be listed here too — otherwise the dev server would stop
  // serving the worktree's own `src/` files.
  return [PROJECT_ROOT, realpathSync(nodeModules)];
}

const fsAllow = resolveFsAllow();

// https://astro.build/config
export default defineConfig({
  // Only present in a symlinked worktree; omitted entirely otherwise so the
  // primary clone runs on Vite's stock defaults.
  ...(fsAllow ? { vite: { server: { fs: { allow: fsAllow } } } } : {}),
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
    preact(),
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
