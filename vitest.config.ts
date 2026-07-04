/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

/**
 * Vitest config, derived from the Astro config so tests share the same
 * resolution/plugins as the app. Coverage is v8-based and scoped to src.
 */
export default getViteConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
    },
  },
});
