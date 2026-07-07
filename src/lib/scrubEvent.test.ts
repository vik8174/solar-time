import { describe, expect, it } from 'vitest';

import { REDACTED, scrubEvent } from './scrubEvent';

describe('scrubEvent', () => {
  it('redacts lat/lon carried in event.extra', () => {
    const scrubbed = scrubEvent({ extra: { lat: 50.4501, lon: 30.5234 } });
    expect(scrubbed.extra).toEqual({ lat: REDACTED, lon: REDACTED });
  });

  it('redacts a nested coordinates object (and everything derived from the fix)', () => {
    const scrubbed = scrubEvent({
      contexts: { position: { coords: { latitude: 50.45, longitude: 30.52, accuracy: 12 } } },
    });
    expect(scrubbed.contexts.position).toBe(REDACTED);
  });

  it('redacts latitude/longitude named keys anywhere in the tree', () => {
    const scrubbed = scrubEvent({ user: { latitude: -33.8, longitude: 151.2 } });
    expect(scrubbed.user).toEqual({ latitude: REDACTED, longitude: REDACTED });
  });

  it('strips lat/lon query parameters from request URLs but keeps the URL shape', () => {
    const scrubbed = scrubEvent({
      request: { url: 'https://solar-time.app/?lat=50.45&lon=30.52&city=kyiv' },
    });
    expect(scrubbed.request.url).toBe(
      `https://solar-time.app/?lat=${REDACTED}&lon=${REDACTED}&city=kyiv`,
    );
  });

  it('strips coordinates from a query_string field', () => {
    const scrubbed = scrubEvent({ request: { query_string: '?latitude=1.5&longitude=2.5' } });
    expect(scrubbed.request.query_string).toBe(`?latitude=${REDACTED}&longitude=${REDACTED}`);
  });

  it('scrubs coordinates hidden inside breadcrumb arrays', () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [
        { message: 'nav', data: { url: 'https://x/?lng=10.1' } },
        { message: 'fix', data: { coords: { latitude: 1, longitude: 2 } } },
      ],
    });
    expect(scrubbed.breadcrumbs[0]?.data).toEqual({ url: `https://x/?lng=${REDACTED}` });
    expect(scrubbed.breadcrumbs[1]?.data.coords).toBe(REDACTED);
  });

  it('leaves non-coordinate data untouched', () => {
    const event = {
      event_id: 'abc123',
      level: 'error',
      tags: { environment: 'production' },
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
    };
    expect(scrubEvent(event)).toEqual(event);
  });

  it('does not mutate the original event (returns a copy)', () => {
    const event = { extra: { lat: 50.45 } };
    scrubEvent(event);
    expect(event.extra.lat).toBe(50.45);
  });

  it('handles null values and primitives without throwing', () => {
    expect(scrubEvent({ user: null, count: 3, ok: true })).toEqual({
      user: null,
      count: 3,
      ok: true,
    });
  });

  it('redacts a shorthand `coord` key as well', () => {
    expect(scrubEvent({ coord: { latitude: 1 } }).coord).toBe(REDACTED);
  });

  it('redacts geo/gps container keys', () => {
    expect(scrubEvent({ extra: { gps: { x: 1 }, geo: 'anything' } }).extra).toEqual({
      gps: REDACTED,
      geo: REDACTED,
    });
  });

  it('redacts a coordinate pair carried as a bare array under any key', () => {
    expect(scrubEvent({ extra: { location: [50.45, 30.52] } }).extra.location).toBe(REDACTED);
  });

  it('leaves a non-coordinate integer array (e.g. dimensions) untouched', () => {
    expect(scrubEvent({ extra: { size: [800, 600] } }).extra.size).toEqual([800, 600]);
  });

  it('scrubs a coordinate pair embedded in a free-text error message', () => {
    const scrubbed = scrubEvent({ message: 'GPS fix failed at 50.4501, 30.5234' });
    expect(scrubbed.message).toBe(`GPS fix failed at ${REDACTED}`);
  });

  it('scrubs coordinates in an exception value string', () => {
    const scrubbed = scrubEvent({
      exception: { values: [{ type: 'GeolocationError', value: 'near 50.4501/30.5234' }] },
    });
    expect(scrubbed.exception.values[0]?.value).toBe(`near ${REDACTED}`);
  });

  it('scrubs a lone high-precision coordinate in free text', () => {
    const scrubbed = scrubEvent({ message: 'latitude was 50.450123 exactly' });
    expect(scrubbed.message).toBe(`latitude was ${REDACTED} exactly`);
  });

  it('does not mangle a version string or short decimal', () => {
    expect(scrubEvent({ message: 'sdk 10.63.0 took 1.5s' }).message).toBe('sdk 10.63.0 took 1.5s');
  });

  it('strips a lat param from a URL fragment', () => {
    const scrubbed = scrubEvent({ request: { url: 'https://x/#lat=50.45&lon=30.52' } });
    expect(scrubbed.request.url).toBe(`https://x/#lat=${REDACTED}&lon=${REDACTED}`);
  });
});
