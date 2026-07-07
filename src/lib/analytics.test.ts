// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_EVENT, trackEvent, type AnalyticsDetail } from './analytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trackEvent', () => {
  it('dispatches a CustomEvent on the window bus with the name and params', () => {
    const received: AnalyticsDetail[] = [];
    const listener = (event: Event): void => {
      received.push((event as CustomEvent<AnalyticsDetail>).detail);
    };
    window.addEventListener(ANALYTICS_EVENT, listener);

    trackEvent('city_selected', { slug: 'kyiv' });

    window.removeEventListener(ANALYTICS_EVENT, listener);
    expect(received).toEqual([{ name: 'city_selected', params: { slug: 'kyiv' } }]);
  });

  it('defaults params to an empty object', () => {
    let detail: AnalyticsDetail | null = null;
    const listener = (event: Event): void => {
      detail = (event as CustomEvent<AnalyticsDetail>).detail;
    };
    window.addEventListener(ANALYTICS_EVENT, listener);

    trackEvent('page_view');

    window.removeEventListener(ANALYTICS_EVENT, listener);
    expect(detail).toEqual({ name: 'page_view', params: {} });
  });

  it('is a no-op when there is no window (SSR / tests)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => {
      trackEvent('geolocation_used');
    }).not.toThrow();
  });
});
