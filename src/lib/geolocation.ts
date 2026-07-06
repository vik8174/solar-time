/**
 * geolocation — the thin I/O adapter over the browser Geolocation and
 * Permissions APIs. It is the boundary the pure `geoReducer` sits behind: it
 * turns a `getCurrentPosition` outcome into a plain `{ lat, lon }` or a typed
 * `GeolocationError`, and never touches the DOM or app state. Tested by stubbing
 * `navigator` at this boundary (see `geolocation.test.ts`).
 *
 * Privacy (PRD): the fix stays in the browser — nothing here transmits it.
 */
import type { GeoCoords } from './geoReducer';

/** Why a location request failed, mapped from the platform error codes. */
export type GeoErrorKind = 'denied' | 'timeout' | 'unavailable' | 'unsupported';

/** A typed geolocation failure the reducer can branch on. */
export class GeolocationError extends Error {
  constructor(
    readonly kind: GeoErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GeolocationError';
  }
}

/** Default fix timeout — the ~8–10 s budget from the acceptance criteria. */
export const DEFAULT_TIMEOUT_MS = 9000;

/** W3C `GeolocationPositionError` codes (2 = POSITION_UNAVAILABLE). */
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

const kindForCode = (code: number): GeoErrorKind => {
  if (code === PERMISSION_DENIED) return 'denied';
  if (code === TIMEOUT) return 'timeout';
  // POSITION_UNAVAILABLE (2) and any unexpected code fall back to "unavailable".
  return 'unavailable';
};

/**
 * Requests a single precise position.
 *
 * @param options.timeoutMs - Max time to wait for a fix (default {@link DEFAULT_TIMEOUT_MS}).
 * @returns The fix as `{ lat, lon }`.
 * @throws {GeolocationError} `unsupported` (no API), `denied`, `timeout`, or `unavailable`.
 */
export const getCurrentPosition = (options?: { timeoutMs?: number }): Promise<GeoCoords> => {
  // The DOM lib declares these APIs as always-present; view `navigator` through
  // an optional shape so the real "old browser" branches type-check honestly.
  const nav: { geolocation?: Geolocation } = navigator;
  const geolocation = nav.geolocation;
  if (!geolocation) {
    return Promise.reject(new GeolocationError('unsupported', 'Geolocation API unavailable'));
  }

  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise<GeoCoords>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      (error) => {
        reject(new GeolocationError(kindForCode(error.code), error.message));
      },
      { enableHighAccuracy: false, timeout, maximumAge: 0 },
    );
  });
};

/**
 * Pre-checks the geolocation permission without prompting, so the UI can decide
 * whether the button will show a native prompt or is already blocked.
 *
 * @returns The permission state, or `'unknown'` when the Permissions API is
 * absent or rejects the geolocation query (as some browsers do).
 */
export const checkPermission = async (): Promise<PermissionState | 'unknown'> => {
  const nav: { permissions?: Permissions } = navigator;
  const permissions = nav.permissions;
  if (!permissions) return 'unknown';
  try {
    const status = await permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
};
