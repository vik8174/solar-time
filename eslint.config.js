// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config.
 *
 * Layers recommended rules for JS/TS and Astro, then disables any
 * stylistic rules that would conflict with Prettier (formatting is
 * Prettier's job, linting is ESLint's).
 */
export default tseslint.config(
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'coverage/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  prettier,
);
