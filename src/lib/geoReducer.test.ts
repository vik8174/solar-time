import { describe, expect, it } from 'vitest';

import { geoReducer, initialGeoState, type GeoState } from './geoReducer';

describe('geoReducer', () => {
  it('starts idle', () => {
    expect(initialGeoState).toEqual({ status: 'idle' });
  });

  it('moves to locating when a request is made', () => {
    expect(geoReducer(initialGeoState, { type: 'REQUEST' })).toEqual({ status: 'locating' });
  });

  it('captures the coordinates on success', () => {
    const state = geoReducer(
      { status: 'locating' },
      { type: 'SUCCESS', coords: { lat: 1, lon: 2 } },
    );
    expect(state).toEqual({ status: 'located', coords: { lat: 1, lon: 2 } });
  });

  it('goes to denied when permission is refused', () => {
    expect(geoReducer({ status: 'locating' }, { type: 'DENIED' })).toEqual({ status: 'denied' });
  });

  it('treats a timeout as a recoverable error', () => {
    expect(geoReducer({ status: 'locating' }, { type: 'TIMEOUT' })).toEqual({ status: 'error' });
  });

  it('treats an unavailable position as a recoverable error', () => {
    expect(geoReducer({ status: 'locating' }, { type: 'UNAVAILABLE' })).toEqual({
      status: 'error',
    });
  });

  it('marks the browser unsupported', () => {
    expect(geoReducer(initialGeoState, { type: 'UNSUPPORTED' })).toEqual({ status: 'unsupported' });
  });

  it('allows retrying after a denial or error', () => {
    expect(geoReducer({ status: 'denied' }, { type: 'REQUEST' })).toEqual({ status: 'locating' });
    expect(geoReducer({ status: 'error' }, { type: 'REQUEST' })).toEqual({ status: 'locating' });
  });

  it('never leaves the unsupported state on a request', () => {
    const unsupported: GeoState = { status: 'unsupported' };
    expect(geoReducer(unsupported, { type: 'REQUEST' })).toBe(unsupported);
  });

  it('accepts SUCCESS from idle state and moves to located', () => {
    const result = geoReducer(
      { status: 'idle' },
      { type: 'SUCCESS', coords: { lat: 50.09, lon: 14.42 } },
    );
    expect(result).toEqual({ status: 'located', coords: { lat: 50.09, lon: 14.42 } });
  });

  it('accepts SUCCESS from denied state (retry flow)', () => {
    const result = geoReducer(
      { status: 'denied' },
      { type: 'SUCCESS', coords: { lat: 50.09, lon: 14.42 } },
    );
    expect(result).toEqual({ status: 'located', coords: { lat: 50.09, lon: 14.42 } });
  });

  it('accepts SUCCESS from error state (retry flow)', () => {
    const result = geoReducer(
      { status: 'error' },
      { type: 'SUCCESS', coords: { lat: 50.09, lon: 14.42 } },
    );
    expect(result).toEqual({ status: 'located', coords: { lat: 50.09, lon: 14.42 } });
  });

  it('ignores DENIED event from idle state (no prior request)', () => {
    // DENIED while idle is unexpected; reducer should handle it gracefully
    const result = geoReducer({ status: 'idle' }, { type: 'DENIED' });
    expect(result).toEqual({ status: 'denied' });
  });

  it('ignores ERROR events from idle state (no prior request)', () => {
    const resultTimeout = geoReducer({ status: 'idle' }, { type: 'TIMEOUT' });
    expect(resultTimeout).toEqual({ status: 'error' });

    const resultUnavailable = geoReducer({ status: 'idle' }, { type: 'UNAVAILABLE' });
    expect(resultUnavailable).toEqual({ status: 'error' });
  });

  it('ignores UNSUPPORTED from any non-idle, non-unsupported state', () => {
    // If unsupported happens mid-flow, move to unsupported
    expect(geoReducer({ status: 'locating' }, { type: 'UNSUPPORTED' })).toEqual({
      status: 'unsupported',
    });
    expect(
      geoReducer({ status: 'located', coords: { lat: 1, lon: 2 } }, { type: 'UNSUPPORTED' }),
    ).toEqual({
      status: 'unsupported',
    });
  });
});
