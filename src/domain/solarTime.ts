/**
 * solarTime — pure astronomy domain for the "how far is my clock from the sun"
 * deviation. Zero DOM, zero I/O; every function is input → output and safe to
 * run in the browser (SSOT for client-side recompute).
 *
 * Sign convention (single across the whole module):
 * `+` means the official clock runs AHEAD of the apparent sun — true solar noon
 * happens AFTER 12:00. West of the zone meridian → positive.
 */

const MINUTES_PER_DEGREE = 4; // Earth turns 15°/hour → 4 min per degree of longitude.
const SOLAR_NOON_IDEAL_MINUTES = 720; // 12:00, minutes from local midnight.
const MINUTES_PER_DAY = 1440; // One full rotation; solar time is cyclic over it.
const HALF_DAY_MINUTES = 720; // Half a day — the principal-range bound.

/**
 * Wrap a cyclic minute quantity into the principal range [−720, +720).
 *
 * Solar time is cyclic over a day, so a longitude offset of +1481 min (a city
 * just across the antimeridian: West longitude on an East UTC zone) is the same
 * clock-vs-sun angle as +41 min — one full day (1440 min) apart. Normalizing
 * keeps the deviation physically meaningful and on the axis.
 *
 * @param minutes - A signed minute quantity to normalize.
 * @returns Equivalent minutes in [−720, +720); a no-op for values already in range.
 */
const wrapMinutes = (minutes: number): number =>
  ((((minutes + HALF_DAY_MINUTES) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) -
  HALF_DAY_MINUTES;

/** Location and instant to evaluate the clock-vs-sun deviation for. */
export interface DeviationInput {
  /** Geographic longitude, east positive (degrees). */
  longitude: number;
  /** IANA time zone id, e.g. "Europe/Prague". */
  timeZone: string;
  /** Instant the deviation is evaluated at (drives EoT and DST). */
  date: Date;
}

/**
 * Additive breakdown of how far the official clock runs ahead of the sun.
 * `+` = clock ahead (true solar noon after 12:00). All values are minutes and
 * `longitudeOffset + equationOfTime + dst === total`.
 */
export interface Deviation {
  /** Contribution from longitude within the zone. */
  longitudeOffset: number;
  /** Contribution from the equation of time (negated classic EoT). */
  equationOfTime: number;
  /** Contribution from daylight-saving time (0 outside DST). */
  dst: number;
  /** Sum of the three components. */
  total: number;
  /** Clock time of true solar noon, minutes from local midnight. */
  solarNoon: number;
}

/**
 * Minutes the clock runs ahead of the sun purely from longitude within the zone.
 *
 * @param longitude - Geographic longitude, east positive (degrees).
 * @param standardOffsetMinutes - Zone's standard (non-DST) UTC offset, minutes.
 * @returns Signed minutes; west of the standard meridian is positive.
 */
export const longitudeOffsetMinutes = (longitude: number, standardOffsetMinutes: number): number =>
  standardOffsetMinutes - MINUTES_PER_DEGREE * longitude;

/**
 * UTC offset of an IANA zone at a given instant, in minutes east of UTC.
 *
 * Derived by formatting the instant into the zone's wall-clock parts and
 * comparing them to the same fields read as UTC — robust for half-hour and
 * 45-minute zones. No hardcoded offset table.
 *
 * @param timeZone - IANA zone id, e.g. "Europe/Prague".
 * @param date - Instant to evaluate.
 * @returns Signed offset minutes (UTC+8 → 480, UTC−5 → −300).
 * @throws {RangeError} If `timeZone` is not a valid IANA zone id (fail-fast —
 * callers must pass validated zone ids, e.g. from the cities dataset).
 */
export const offsetMinutes = (timeZone: string, date: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const field = (type: string): number => Number(parts.find((p) => p.type === type)?.value);

  const wallAsUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  );
  return Math.round((wallAsUtc - date.getTime()) / 60_000);
};

/**
 * Standard (non-DST) UTC offset of a zone for the year of `date`, in minutes.
 *
 * DST always advances the clock, so the standard offset is the smaller of the
 * mid-winter and mid-summer offsets — which correctly handles both hemispheres,
 * non-integer DST shifts (e.g. Lord Howe's 30 min), and DST-free zones (where
 * the two samples are equal). The 15th at noon UTC is chosen as the anchor
 * because no real IANA zone runs a DST transition mid-month at midday, so
 * neither sample can land inside a transition window.
 *
 * @param timeZone - IANA zone id.
 * @param date - Any instant in the target year.
 * @returns Standard offset minutes.
 * @throws {RangeError} If `timeZone` is not a valid IANA zone id.
 */
export const standardOffsetMinutes = (timeZone: string, date: Date): number => {
  const year = date.getUTCFullYear();
  const january = new Date(Date.UTC(year, 0, 15, 12));
  const july = new Date(Date.UTC(year, 6, 15, 12));
  return Math.min(offsetMinutes(timeZone, january), offsetMinutes(timeZone, july));
};

/**
 * Daylight-saving contribution in effect at `date`, in minutes.
 *
 * @param timeZone - IANA zone id.
 * @param date - Instant to evaluate.
 * @returns 0 outside DST, +60 (or the zone's shift) during DST.
 */
export const dstMinutes = (timeZone: string, date: Date): number =>
  offsetMinutes(timeZone, date) - standardOffsetMinutes(timeZone, date);

/**
 * Deviation of the official clock from apparent solar time at a location.
 *
 * Combines three independent effects — longitude within the zone, the equation
 * of time, and daylight saving — into a single additive breakdown plus the
 * resulting solar-noon clock time. Pure: no DOM, no I/O.
 *
 * @param input - Longitude, IANA zone, and the instant to evaluate.
 * @returns Signed minute breakdown; `+` means the clock is ahead of the sun.
 * @throws {RangeError} If `timeZone` is not a valid IANA zone id.
 *
 * @example
 * computeDeviation({ longitude: 14.42, timeZone: 'Europe/Prague', date });
 */
export const computeDeviation = ({ longitude, timeZone, date }: DeviationInput): Deviation => {
  const standardOffset = standardOffsetMinutes(timeZone, date);
  // Wrap the cyclic longitude component so antimeridian cities (West longitude on
  // an East UTC zone) don't overflow by a full day; a no-op for in-range cities.
  const longitudeOffset = wrapMinutes(longitudeOffsetMinutes(longitude, standardOffset));
  // Negate the classic (apparent − mean) EoT so a sundial running fast moves the
  // clock's lead over the sun in the same direction as the other components.
  const equationOfTime = -equationOfTimeMinutes(date);
  const dst = dstMinutes(timeZone, date);
  const total = longitudeOffset + equationOfTime + dst;

  return {
    longitudeOffset,
    equationOfTime,
    dst,
    total,
    solarNoon: SOLAR_NOON_IDEAL_MINUTES + total,
  };
};

/** Radians in one turn. */
const TAU = 2 * Math.PI;
/** Degrees-of-hour-angle → minutes of time (1440 min / 360°). */
const DEGREES_TO_MINUTES = 229.18;

/**
 * Fractional year γ (radians) per the NOAA solar position algorithm.
 * Day-of-year and hour are taken in UTC.
 */
const fractionalYear = (date: Date): number => {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return (TAU / 365) * (dayOfYear - 1 + (hour - 12) / 24);
};

/**
 * Equation of time = apparent solar time − mean solar time (minutes).
 *
 * NOAA/Meeus Fourier approximation; accurate to a few seconds. Positive means
 * the sundial runs ahead of the mean clock (early November); negative means it
 * lags (mid-February).
 *
 * @param date - Instant to evaluate (day-of-year drives the value).
 * @returns Signed minutes of apparent minus mean solar time.
 */
export const equationOfTimeMinutes = (date: Date): number => {
  const g = fractionalYear(date);
  return (
    DEGREES_TO_MINUTES *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  );
};
