/**
 * cityViewModel — turns a raw Deviation into ready-to-render display strings
 * and scale geometry. Pure and SSOT for what the city page shows: the Astro
 * build and the client recompute both call this, so they never diverge.
 */

import type { Deviation } from '../domain/solarTime';
import { formatClock, isInSync, signedMinutes } from './format';
import { scaleGeometry, type ScaleGeometry } from './scaleGeometry';

/** Static identity of the city being rendered. */
export interface CityIdentity {
  name: string;
  /** Human-readable coordinates for the eyebrow, e.g. "50.08°N, 14.44°E". */
  coords: string;
}

/** One line of the three-part breakdown (or the total row). */
export interface BreakdownRow {
  key: 'longitude' | 'equationOfTime' | 'dst' | 'total';
  label: string;
  /** Static explanatory hint; empty for the total row. */
  hint: string;
  /** Signed, rounded value, e.g. "+60" or "0". */
  value: string;
  /** True when the component rounds to zero — UI dims it but keeps it listed. */
  zero: boolean;
}

/** Everything the city page needs to render, derived from one Deviation. */
export interface CityViewModel {
  cityName: string;
  coords: string;
  inSync: boolean;
  /** Hero text: signed minutes, or "In sync". */
  heroValue: string;
  /** Whether to show the "min" unit next to the hero. */
  showUnit: boolean;
  /** Sentence describing magnitude and direction. */
  leadText: string;
  /** Sentence stating the real solar-noon clock time. */
  solarNoonText: string;
  breakdown: BreakdownRow[];
  geometry: ScaleGeometry;
}

const HINTS: Record<Exclude<BreakdownRow['key'], 'total'>, { label: string; hint: string }> = {
  longitude: { label: 'Longitude', hint: 'Your spot within the time zone' },
  equationOfTime: { label: 'Equation of time', hint: "Earth's tilt and orbit" },
  dst: { label: 'Daylight saving', hint: 'Summer clock shift' },
};

/** Builds the signed lead sentence, honouring the in-sync edge case. */
const buildLeadText = (total: number): string => {
  if (isInSync(total)) return 'Your clock matches the sun right now.';
  const magnitude = Math.abs(Math.round(total));
  const unit = magnitude === 1 ? 'minute' : 'minutes';
  const direction = total > 0 ? 'ahead' : 'behind';
  return `Your clock runs ${magnitude} ${unit} ${direction} of the sun.`;
};

/** One breakdown row from a raw component value. */
const row = (key: Exclude<BreakdownRow['key'], 'total'>, value: number): BreakdownRow => ({
  key,
  label: HINTS[key].label,
  hint: HINTS[key].hint,
  value: signedMinutes(value),
  zero: Math.round(value) === 0,
});

/**
 * Derives the full view model for a city from its deviation.
 *
 * @param city - Static city identity (name, coordinates).
 * @param d - Clock-vs-sun deviation for the instant being rendered.
 * @returns Display-ready strings and scale geometry.
 */
export const buildCityViewModel = (city: CityIdentity, d: Deviation): CityViewModel => {
  const synced = isInSync(d.total);
  return {
    cityName: city.name,
    coords: city.coords,
    inSync: synced,
    heroValue: synced ? 'In sync' : signedMinutes(d.total),
    showUnit: !synced,
    leadText: buildLeadText(d.total),
    solarNoonText: `Real solar noon today is at ${formatClock(d.solarNoon)}.`,
    breakdown: [
      row('longitude', d.longitudeOffset),
      row('equationOfTime', d.equationOfTime),
      row('dst', d.dst),
      { key: 'total', label: 'Total', hint: '', value: signedMinutes(d.total), zero: false },
    ],
    geometry: scaleGeometry(d.total),
  };
};
