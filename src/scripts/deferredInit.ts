/**
 * deferredInit — the browser entry that boots analytics + error monitoring
 * without blocking first paint (D-008, D-021, PRD stories 29–30).
 *
 * This is the thin adapter over the tested pure core: it wires the real idle
 * scheduler (`idleScheduler`), the env readers (`analyticsEnv`), the privacy
 * scrub (`scrubEvent`) and the event bus (`analytics`) to the two true-external
 * SDKs, which are **dynamically imported inside the idle callback** so neither
 * ships in the critical path. Mounted once from `Base.astro` as a plain module
 * `<script>` — not a Preact island — to stay clear of the island runtime (D-021).
 *
 * Design guarantees:
 * - **Non-blocking:** both SDKs load + init only after `requestIdleCallback`.
 * - **Boot once:** `createDeferredRunner` guards against the mount script's
 *   re-execution across View-Transition navigations.
 * - **Cookieless analytics:** GA4 Consent Mode `analytics_storage: 'denied'`
 *   → no cookies, anonymous cookieless pings; automatic page_view and ad
 *   signals are off (we emit our own events).
 * - **Error-only monitoring:** `tracesSampleRate: 0` and no tracing/replay
 *   integrations are ever imported, so none ship; `beforeSend` runs the scrub.
 * - **No event lost to the boot delay:** events emitted before the SDK is ready
 *   are buffered and flushed once analytics is live.
 */
import { trackEvent, ANALYTICS_EVENT, type AnalyticsDetail } from '../lib/analytics';
import { readFirebaseConfig, readSentryDsn, type EnvRecord } from '../lib/analyticsEnv';
import { createEventBuffer } from '../lib/eventBuffer';
import { createDeferredRunner } from '../lib/idleScheduler';
import { scrubEvent } from '../lib/scrubEvent';

/** Forwards an anonymous event to the live analytics SDK. */
type EventSink = (detail: AnalyticsDetail) => void;

/** Collects the typed `PUBLIC_*` env vars into the record the readers expect. */
const collectEnv = (): EnvRecord => ({
  PUBLIC_FIREBASE_API_KEY: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_APP_ID: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  PUBLIC_FIREBASE_MEASUREMENT_ID: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
  PUBLIC_SENTRY_DSN: import.meta.env.PUBLIC_SENTRY_DSN,
});

/**
 * Boots Firebase Analytics in cookieless mode and returns a sink that forwards
 * bus events to it, or `null` when analytics is not configured / unsupported.
 */
const bootAnalytics = async (env: EnvRecord): Promise<EventSink | null> => {
  const config = readFirebaseConfig(env);
  if (!config) return null;

  const [{ initializeApp }, { initializeAnalytics, isSupported, logEvent, setConsent }] =
    await Promise.all([import('firebase/app'), import('firebase/analytics')]);
  // Bail on browsers without the storage/APIs Analytics needs (e.g. some
  // private-mode / in-app webviews) instead of throwing (Firebase guidance).
  if (!(await isSupported())) return null;

  // Cookieless via GA4 Consent Mode. With `analytics_storage: 'denied'`, GA4
  // writes NO cookies and sends anonymous cookieless pings — this is the
  // effective switch. (gtag `client_storage: 'none'` alone does NOT stop GA4's
  // `_ga`/`_ga_*` cookies — verified in-browser — so it is not relied on.) Set
  // before init so it becomes the `consent default` ahead of the first config.
  setConsent({
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });

  const app = initializeApp(config);
  // Suppress the automatic page_view (we emit our own) and all advertising
  // signals — named fields of Firebase's `GtagConfigParams`.
  const gtagConfig = {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  };
  const analytics = initializeAnalytics(app, { config: gtagConfig });

  // Firebase overloads `logEvent` so reserved names (e.g. `page_view`) demand a
  // specific gtag param shape; we log our anonymous events as plain named events
  // (GA accepts this), so narrow to the documented string form. Not `any` — a
  // typed view of the existing overload set.
  const log = logEvent as (
    instance: typeof analytics,
    name: string,
    params: Record<string, string | number | boolean>,
  ) => void;

  return ({ name, params }: AnalyticsDetail): void => {
    log(analytics, name, params);
  };
};

/**
 * Boots Sentry as an error-only monitor with the GPS scrub. No tracing/replay
 * integrations are imported, so none ship; `tracesSampleRate: 0` is the belt.
 */
const bootMonitoring = async (env: EnvRecord, environment: string): Promise<void> => {
  const dsn = readSentryDsn(env);
  if (!dsn) return;

  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn,
    environment,
    // Error-only: no performance transactions are ever sampled.
    tracesSampleRate: 0,
    // Privacy-critical: strip GPS/coordinates from every event before it leaves
    // the browser (PRD story 30). `scrubEvent` is the tested pure body.
    beforeSend: (event) => scrubEvent(event),
  });
};

/**
 * Subscribes to the analytics bus and schedules both SDKs to boot on idle,
 * exactly once. Safe to call unconditionally from the page shell.
 *
 * @param environment - The Sentry environment tag (`staging` | `production`),
 *   resolved at build time from `SITE_ENV` (see `site.ts`).
 */
export const startDeferredInit = (environment: string): void => {
  const env = collectEnv();

  // Bus events emitted before analytics boots are buffered (bounded) and flushed
  // once the SDK is live — see `createEventBuffer`.
  const buffer = createEventBuffer<AnalyticsDetail>();

  window.addEventListener(ANALYTICS_EVENT, (event: Event) => {
    buffer.push((event as CustomEvent<AnalyticsDetail>).detail);
  });

  const boot = (): void => {
    void bootAnalytics(env)
      .then((sink) => {
        if (sink) buffer.attach(sink);
      })
      .catch((error: unknown) => {
        console.warn('deferredInit: analytics boot failed', error);
      });

    void bootMonitoring(env, environment).catch((error: unknown) => {
      console.warn('deferredInit: monitoring boot failed', error);
    });
  };

  createDeferredRunner()(boot);
};

/** Re-exported so the page shell emits `page_view` through the same bus. */
export { trackEvent };
