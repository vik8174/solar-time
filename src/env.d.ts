/// <reference types="astro/client" />

/**
 * Typed client-exposed env vars (Astro `PUBLIC_*`, inlined at build). Declaring
 * them as `string | undefined` — instead of leaning on Vite's `any` index
 * signature — keeps `deferredInit`'s reads type-safe under `strictTypeChecked`
 * (D-011). All are optional: absent keys mean the SDK stays off (analyticsEnv).
 */
interface ImportMetaEnv {
  /** Firebase web API key. */
  readonly PUBLIC_FIREBASE_API_KEY?: string;
  /** Firebase auth domain (optional for Analytics-only). */
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  /** Firebase project id. */
  readonly PUBLIC_FIREBASE_PROJECT_ID?: string;
  /** Firebase web app id. */
  readonly PUBLIC_FIREBASE_APP_ID?: string;
  /** Google Analytics measurement id (`G-…`) that drives Firebase Analytics. */
  readonly PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
  /** Sentry DSN for the browser error monitor. */
  readonly PUBLIC_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
