/**
 * analyticsEnv — pure readers that turn `import.meta.env` into typed SDK config
 * (D-008, D-012).
 *
 * The client SDKs run in the browser, so their keys are exposed as Astro
 * `PUBLIC_*` env vars (inlined at build). These readers are the pure boundary
 * that validates that raw, `string | undefined`-typed bag: a fully-configured
 * environment yields a config object, an incomplete one yields `null` — which
 * `deferredInit` treats as "that SDK stays off". That keeps missing keys a
 * no-op (local dev, CI, and the build all run green without real secrets)
 * instead of a runtime crash, and keeps the parsing testable without a browser.
 */

/** Minimal Firebase web config needed to boot Analytics (measurementId-driven). */
export interface FirebaseConfig {
  readonly apiKey: string;
  readonly projectId: string;
  readonly appId: string;
  readonly measurementId: string;
  /** Optional — only included when the env var is set. */
  readonly authDomain?: string;
}

/** A raw env bag, as produced by `import.meta.env`. */
export type EnvRecord = Record<string, string | undefined>;

/** Returns a trimmed non-empty string, or `undefined` for missing/blank values. */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Parses the Firebase web-config env vars.
 *
 * @param env - The env bag (`import.meta.env`).
 * @returns A `FirebaseConfig` when every required key is present, else `null`.
 */
export const readFirebaseConfig = (env: EnvRecord): FirebaseConfig | null => {
  const apiKey = clean(env['PUBLIC_FIREBASE_API_KEY']);
  const projectId = clean(env['PUBLIC_FIREBASE_PROJECT_ID']);
  const appId = clean(env['PUBLIC_FIREBASE_APP_ID']);
  const measurementId = clean(env['PUBLIC_FIREBASE_MEASUREMENT_ID']);
  if (!apiKey || !projectId || !appId || !measurementId) return null;

  const authDomain = clean(env['PUBLIC_FIREBASE_AUTH_DOMAIN']);
  return { apiKey, projectId, appId, measurementId, ...(authDomain ? { authDomain } : {}) };
};

/**
 * Parses the Sentry DSN env var.
 *
 * @param env - The env bag (`import.meta.env`).
 * @returns `{ dsn }` when configured, else `null`.
 */
export const readSentryDsn = (env: EnvRecord): string | null =>
  clean(env['PUBLIC_SENTRY_DSN']) ?? null;
