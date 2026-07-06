/**
 * ogCard — pure text model for the build-time Open Graph card.
 *
 * The OG image is an I/O boundary (satori + resvg live in `src/og/`), but the
 * *what* it shows — the big number, its unit, the city name, the caption — is
 * pure and derived here so it can be unit-tested under the D-012 gate. It uses
 * the same `format` helpers as `cityViewModel`, so the card's number is always
 * the one the page shows (SSOT, R-001) rather than a re-implementation.
 */

import type { Deviation } from '../domain/solarTime';
import { isInSync, signedMinutes } from './format';

/** The text a single OG card renders. */
export interface OgCardModel {
  /** Hero value: signed minutes ("+48") or "In sync". */
  value: string;
  /** Unit after the value ("min"); empty when in sync. */
  unit: string;
  /** City name line. */
  city: string;
  /** Direction caption ("ahead of the sun" / "behind the sun"); empty when in sync. */
  caption: string;
}

/**
 * Derives the OG card text for a city from its deviation.
 *
 * @param cityName - Display name to print under the number.
 * @param d - Clock-vs-sun deviation baked at build time.
 * @returns The card's value, unit, city, and caption strings.
 */
export const ogCardModel = (cityName: string, d: Deviation): OgCardModel => {
  if (isInSync(d.total)) {
    return { value: 'In sync', unit: '', city: cityName, caption: '' };
  }
  return {
    value: signedMinutes(d.total),
    unit: 'min',
    city: cityName,
    caption: d.total > 0 ? 'ahead of the sun' : 'behind the sun',
  };
};
