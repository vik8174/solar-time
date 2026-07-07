/**
 * analytics — the tiny, SDK-agnostic event bus the UI emits onto (D-008, D-012).
 *
 * Islands (search, geolocation) must be able to log an anonymous event without
 * importing or knowing about Firebase — otherwise the SDK would leak into every
 * island bundle and couple the UI to the vendor. Instead they call `trackEvent`,
 * which dispatches a `CustomEvent` on `window`; `deferredInit` is the single
 * subscriber that forwards it to Firebase Analytics once the SDK has booted (and
 * buffers events fired before then). The event context persists across View
 * Transitions, so an event fired just before a client-side navigation survives.
 *
 * Payloads are anonymous by contract: `geolocation_used` carries **no
 * coordinates** — only that the feature was used.
 */

/** The `window` event name carrying analytics payloads on the bus. */
export const ANALYTICS_EVENT = 'solar-time:analytics';

/** The closed set of anonymous events the site reports (PRD story 29). */
export type AnalyticsEventName = 'page_view' | 'city_selected' | 'geolocation_used';

/** Non-identifying event parameters (e.g. a city slug, a page path). */
export type AnalyticsParams = Record<string, string | number | boolean>;

/** The `detail` shape carried by an {@link ANALYTICS_EVENT} `CustomEvent`. */
export interface AnalyticsDetail {
  readonly name: AnalyticsEventName;
  readonly params: AnalyticsParams;
}

/**
 * Emits an anonymous analytics event onto the window bus. A no-op off-DOM (SSR,
 * tests without a window), so callers never need to guard the environment.
 *
 * @param name - The event name.
 * @param params - Optional non-identifying parameters. Never pass coordinates.
 */
export const trackEvent = (name: AnalyticsEventName, params: AnalyticsParams = {}): void => {
  if (typeof window === 'undefined') return;
  const detail: AnalyticsDetail = { name, params };
  window.dispatchEvent(new CustomEvent<AnalyticsDetail>(ANALYTICS_EVENT, { detail }));
};
