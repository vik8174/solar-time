/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

/**
 * Vitest config, derived from the Astro config so tests share the same
 * resolution/plugins as the app. Coverage is v8-based and scoped to the
 * logic dirs (`src/lib`, `src/domain`) with enforced thresholds; under
 * threshold, `vitest run --coverage` exits non-zero.
 *
 * `src/data` is excluded on purpose — it holds generated tables (e.g.
 * `cities.ts`) that are rewritten wholesale by data slices and carry no
 * hand-written logic to test.
 */
export default getViteConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/domain/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}'],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 80 },
    },
  },
});
