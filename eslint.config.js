// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config.
 *
 * Layers recommended JS rules and typescript-eslint's `strictTypeChecked`
 * (type-aware linting) for TS, plus Astro's recommended rules. Type-aware
 * rules are disabled for `.astro` files (the astro parser doesn't feed the
 * TS program) and non-null assertions are allowed in tests. Prettier stays
 * last so formatting is Prettier's job and linting is ESLint's.
 */
export default defineConfig(
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'coverage/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // SVG/render code interpolates numbers into template literals by design.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  ...astro.configs.recommended,
  {
    // The astro parser doesn't feed the TS program, so type-aware rules can't
    // resolve types here — there's no astro type-checked preset.
    files: ['**/*.astro'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // `!` is necessary under `strictest` tsconfig (e.g. `ticks[i]!`); allow it
    // in tests only, where the invariant is guaranteed by the test setup.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
