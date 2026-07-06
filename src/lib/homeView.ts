/**
 * homeView — pure display helpers for the live home page (`/`): the personal
 * result label and the quiet status copy. Kept out of the island so the wording
 * and the "near" threshold have one tested source of truth (no DOM, no I/O).
 */
import type { NearestCity } from './findNearestCity';
import type { GeoState } from './geoReducer';

/**
 * Maximum distance (km) at which the nearest city is close enough to name.
 * Beyond this the fix is between cities and "near {city}" would mislead, so the
 * label shows only "Your location".
 */
export const NEAR_THRESHOLD_KM = 100;

/** The two-part label under a precise geolocation result. */
export interface LocatedLabel {
  /** Always "Your location". */
  primary: string;
  /** "near {city}" when a city is within the threshold, else `null`. */
  near: string | null;
}

/**
 * Builds the label for a precise fix.
 *
 * @param nearest - Closest city to the fix, or `null` when none is known.
 * @returns "Your location" plus an optional "near {city}" suffix.
 */
export const locatedLabel = (nearest: NearestCity | null): LocatedLabel => ({
  primary: 'Your location',
  near:
    nearest !== null && nearest.distanceKm <= NEAR_THRESHOLD_KM
      ? `near ${nearest.city.name}`
      : null,
});

/**
 * The quiet one-line explanation shown for a non-working geolocation state.
 * The working states (idle / locating / located) show no hint.
 *
 * @param status - Current geolocation status.
 * @returns Hint copy, or `null` when nothing should be shown.
 */
export const geoStatusHint = (status: GeoState['status']): string | null => {
  switch (status) {
    case 'denied':
      return 'Location is blocked — search for your city instead.';
    case 'error':
      return "Couldn't get your location — showing your time-zone estimate.";
    case 'unsupported':
      return 'Your browser has no location support — search for your city.';
    case 'idle':
    case 'locating':
    case 'located':
      return null;
  }
};
