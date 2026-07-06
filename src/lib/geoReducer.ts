/**
 * geoReducer — the pure state machine behind the "📍 my location" flow on the
 * live home page (`/`). Geolocation is the I/O boundary; this reducer keeps the
 * decision logic out of the component so it can be driven purely by feeding
 * events (no `navigator`, no DOM). The thin adapter (`geolocation.ts`) turns
 * real Geolocation/Permissions outcomes into these events.
 *
 * States: `idle` → `locating` → `located` | `denied` | `error`; `unsupported`
 * is terminal (no Geolocation API at all). `denied` and `error` are retryable.
 */

/** A resolved GPS fix. */
export interface GeoCoords {
  /** Latitude, north positive (degrees). */
  lat: number;
  /** Longitude, east positive (degrees). */
  lon: number;
}

/** The geolocation flow's discrete states. */
export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'located'; coords: GeoCoords }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'unsupported' };

/** Events the adapter feeds the reducer. */
export type GeoEvent =
  | { type: 'REQUEST' }
  | { type: 'SUCCESS'; coords: GeoCoords }
  | { type: 'DENIED' }
  | { type: 'TIMEOUT' }
  | { type: 'UNAVAILABLE' }
  | { type: 'UNSUPPORTED' };

/** The flow always begins idle (no permission touched, default city shown). */
export const initialGeoState: GeoState = { status: 'idle' };

/**
 * Computes the next geolocation state.
 *
 * @param state - Current state.
 * @param event - Event from the geolocation adapter.
 * @returns The next state (the same reference when nothing changes).
 */
export const geoReducer = (state: GeoState, event: GeoEvent): GeoState => {
  switch (event.type) {
    case 'REQUEST':
      // A browser with no Geolocation API can never leave `unsupported`.
      return state.status === 'unsupported' ? state : { status: 'locating' };
    case 'SUCCESS':
      return { status: 'located', coords: event.coords };
    case 'DENIED':
      return { status: 'denied' };
    case 'TIMEOUT':
    case 'UNAVAILABLE':
      return { status: 'error' };
    case 'UNSUPPORTED':
      return { status: 'unsupported' };
  }
};
