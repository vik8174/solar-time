/**
 * format — pure display helpers for the city page (SSOT for its edge cases).
 * No DOM, no locale dependency; safe to reuse in the client recompute script.
 */

/** Below this magnitude (minutes) the clock is treated as matching the sun. */
const IN_SYNC_THRESHOLD = 1;

/**
 * Formats a signed minute value for display, rounded to a whole minute.
 * Positive values get "+", negative "-", and an exact zero shows no sign.
 *
 * @param minutes - Signed minutes (may be fractional).
 * @returns e.g. "+66", "-11", "0".
 */
export const signedMinutes = (minutes: number): string => {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${rounded}` : `-${Math.abs(rounded)}`;
};

const MINUTES_PER_DAY = 1440;

/**
 * Formats minutes-from-midnight as a 24-hour zero-padded clock time.
 *
 * @param minutesFromMidnight - Wall-clock minutes since local midnight.
 * @returns e.g. "13:06".
 */
export const formatClock = (minutesFromMidnight: number): string => {
  // Wrap into a single day so extreme deviations never render "13:-5" or 25:xx.
  const total =
    ((Math.round(minutesFromMidnight) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
};

/**
 * Whether the deviation is small enough to show "In sync" instead of a number.
 *
 * @param totalMinutes - Signed total clock-vs-sun deviation.
 * @returns True when |deviation| < 1 minute.
 */
export const isInSync = (totalMinutes: number): boolean =>
  Math.abs(totalMinutes) < IN_SYNC_THRESHOLD;
