/**
 * cityProse — a short, human sentence-or-two describing a city's clock-vs-sun
 * situation, for the indexable `/[city]` pages (issue #87, unique-content half).
 *
 * **Truthful and derived (R-001).** Every number comes from the *same*
 * build-time `Deviation` the hero and breakdown use — magnitude, direction, the
 * longitude-vs-meridian fact, and the real solar-noon clock time. Nothing is
 * recomputed or invented, so the prose can never contradict the page. Like the
 * SEO description (`seoMeta`, D-003), it is baked at build date and not part of
 * the client recompute; the ±1-minute lifetime drift is the accepted D-003
 * trade-off for both.
 *
 * **Genuinely distinct per city (no duplicate-content pattern).** The wording is
 * chosen from the real data, not a single template with the number swapped: the
 * opener varies across three magnitude bands and the in-sync case, the direction
 * flips the preposition, and the geographic clause reports which side of the
 * zone meridian the city sits on. Two cities produce materially different text.
 */
import type { Deviation } from '../domain/solarTime';
import { formatClock, isInSync } from './format';

/** The city identity the prose needs (name + geographic longitude). */
export interface ProseCity {
  name: string;
  /** Geographic longitude, east positive (degrees). */
  longitude: number;
}

/** Below this magnitude (minutes) the opener switches to "close to the sun". */
const SLIGHT_MAX = 10;
/** At or above this magnitude (minutes) the opener switches to "a wide gap". */
const LARGE_MIN = 30;

/** Formats a signed longitude as an unsigned magnitude + hemisphere, e.g. "14.4° E". */
const formatLongitude = (longitude: number): string =>
  `${Math.abs(longitude).toFixed(1)}° ${longitude >= 0 ? 'E' : 'W'}`;

/**
 * Which side of its zone's reference meridian the city sits on, read from the
 * sign of the longitude component (positive ⇒ clock ahead of sun ⇒ west of it).
 */
const meridianSide = (longitudeOffset: number): string => {
  if (longitudeOffset > 0) return 'west of';
  if (longitudeOffset < 0) return 'east of';
  return 'right on';
};

/** The magnitude-banded opening clause (varies wording, not just the number). */
const opener = (name: string, magnitude: number, direction: string): string => {
  const unit = magnitude === 1 ? 'minute' : 'minutes';
  if (magnitude < SLIGHT_MAX) {
    return `In ${name}, the clock keeps close to the sun — only ${magnitude} ${unit} ${direction} solar time.`;
  }
  if (magnitude >= LARGE_MIN) {
    return `In ${name}, the clock sits a wide ${magnitude} ${unit} ${direction} the sun.`;
  }
  return `In ${name}, the clock runs ${magnitude} ${unit} ${direction} the sun.`;
};

/**
 * Builds the per-city descriptive prose from its build-time deviation.
 *
 * @param city - City identity (display name + longitude).
 * @param d - Clock-vs-sun deviation baked at build time (the SSOT number).
 * @returns One or two plain sentences, genuinely distinct per city.
 */
export const cityProse = (city: ProseCity, d: Deviation): string => {
  const noon = formatClock(d.solarNoon);
  const lon = formatLongitude(city.longitude);

  if (isInSync(d.total)) {
    return (
      `In ${city.name}, the clock and the sun stay in step: solar noon lands at ${noon}, ` +
      `within a minute of clock noon. Sitting near its time-zone meridian at ${lon}, ` +
      `${city.name} barely drifts from mean solar time.`
    );
  }

  const magnitude = Math.abs(Math.round(d.total));
  const direction = d.total > 0 ? 'ahead of' : 'behind';
  const side = meridianSide(d.longitudeOffset);

  return (
    `${opener(city.name, magnitude, direction)} ` +
    `At ${lon}, the city lies ${side} its time-zone meridian, and true solar noon arrives at ${noon}.`
  );
};
