// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkPermission, getCurrentPosition, GeolocationError } from './geolocation';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stubs `navigator.geolocation` with a success callback fed `coords`. */
const stubSuccess = (coords: { latitude: number; longitude: number }): void => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (pos: { coords: typeof coords }) => void) => {
        success({ coords });
      },
    },
  });
};

/** Stubs `navigator.geolocation` with an error callback of the given code. */
const stubError = (code: number): void => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        _success: unknown,
        error: (err: { code: number; message: string }) => void,
      ) => {
        error({ code, message: 'stub' });
      },
    },
  });
};

describe('getCurrentPosition', () => {
  it('resolves the latitude and longitude of a successful fix', async () => {
    stubSuccess({ latitude: 50.09, longitude: 14.42 });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 50.09, lon: 14.42 });
  });

  it('handles zero coordinates', async () => {
    stubSuccess({ latitude: 0, longitude: 0 });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 0, lon: 0 });
  });

  it('handles negative coordinates (southern and western hemispheres)', async () => {
    stubSuccess({ latitude: -33.87, longitude: -70.67 });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: -33.87, lon: -70.67 });
  });

  it('handles extreme coordinates (poles)', async () => {
    stubSuccess({ latitude: 90, longitude: 0 });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 90, lon: 0 });
  });

  it('rejects as "denied" when permission is refused (code 1)', async () => {
    stubError(1);
    await expect(getCurrentPosition()).rejects.toMatchObject({ kind: 'denied' });
  });

  it('rejects as "unavailable" when the position cannot be determined (code 2)', async () => {
    stubError(2);
    await expect(getCurrentPosition()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('rejects as "timeout" when the fix times out (code 3)', async () => {
    stubError(3);
    await expect(getCurrentPosition()).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('rejects as "unavailable" for unknown error codes', async () => {
    stubError(999);
    await expect(getCurrentPosition()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('rejects as "unsupported" when the browser has no Geolocation API', async () => {
    vi.stubGlobal('navigator', {});
    const error = await getCurrentPosition().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeolocationError);
    expect((error as GeolocationError).kind).toBe('unsupported');
  });

  it('passes the configured timeout to the underlying API', async () => {
    const calls: unknown[][] = [];
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (...args: unknown[]) => {
          calls.push(args);
          (args[0] as (pos: { coords: { latitude: number; longitude: number } }) => void)({
            coords: { latitude: 0, longitude: 0 },
          });
        },
      },
    });
    await getCurrentPosition({ timeoutMs: 1234 });
    expect(calls[0]?.[2]).toMatchObject({ timeout: 1234 });
  });

  it('uses default timeout when not specified', async () => {
    const calls: unknown[][] = [];
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (...args: unknown[]) => {
          calls.push(args);
          (args[0] as (pos: { coords: { latitude: number; longitude: number } }) => void)({
            coords: { latitude: 0, longitude: 0 },
          });
        },
      },
    });
    await getCurrentPosition();
    expect(calls[0]?.[2]).toMatchObject({ timeout: 9000 });
  });

  it('passes enableHighAccuracy: false for efficiency', async () => {
    const calls: unknown[][] = [];
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (...args: unknown[]) => {
          calls.push(args);
          (args[0] as (pos: { coords: { latitude: number; longitude: number } }) => void)({
            coords: { latitude: 0, longitude: 0 },
          });
        },
      },
    });
    await getCurrentPosition();
    expect(calls[0]?.[2]).toMatchObject({ enableHighAccuracy: false, maximumAge: 0 });
  });
});

describe('checkPermission', () => {
  it('reports the Permissions API state', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.resolve({ state: 'granted' }) },
    });
    await expect(checkPermission()).resolves.toBe('granted');
  });

  it('returns "unknown" when the Permissions API is absent', async () => {
    vi.stubGlobal('navigator', {});
    await expect(checkPermission()).resolves.toBe('unknown');
  });

  it('returns "unknown" when the query rejects (some browsers throw)', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.reject(new Error('unsupported name')) },
    });
    await expect(checkPermission()).resolves.toBe('unknown');
  });
});
