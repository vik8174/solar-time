/**
 * scaleWindow — sizing logic for the solar-noon scale (pure, no DOM).
 *
 * The scale is a time-of-day axis centered on ideal noon (offset 0), with the
 * solar-noon marker at the signed total deviation. This picks the tightest
 * round, symmetric window whose ticks divide evenly and whose edge always
 * clears the marker, so the dot never collides with the axis end.
 */

/** A symmetric, round-bounded axis window, all values in signed minutes from noon. */
export interface ScaleWindow {
  /** Lower bound (negative of `max`). */
  min: number;
  /** Upper bound (half-span). */
  max: number;
  /** Constant tick spacing; divides `max` evenly. */
  step: number;
  /** Tick positions from `min` to `max`, always including 0. */
  ticks: number[];
}

/** Widest window — the fallback when the deviation exceeds every tighter preset. */
const WIDEST: { max: number; step: number } = { max: 720, step: 180 };

/** Round (half-span, step) presets, ascending — the ladder of allowed windows. */
const LADDER: ReadonlyArray<{ max: number; step: number }> = [
  { max: 30, step: 15 },
  { max: 60, step: 30 },
  { max: 90, step: 30 },
  { max: 120, step: 30 },
  { max: 180, step: 60 },
  { max: 240, step: 60 },
  { max: 360, step: 120 },
  { max: 480, step: 120 },
  WIDEST,
];

/** Fraction of the half-span the marker may reach before the next window is used. */
const EDGE_CLEARANCE = 0.85;

/**
 * Picks the scale window for a given total deviation.
 *
 * @param totalMinutes - Signed clock-vs-sun deviation; the marker sits here.
 * @returns The tightest round window that keeps the marker off the edge.
 */
export const scaleWindow = (totalMinutes: number): ScaleWindow => {
  const magnitude = Math.abs(totalMinutes);
  const fit = LADDER.find((entry) => magnitude <= entry.max * EDGE_CLEARANCE) ?? WIDEST;

  const ticks: number[] = [];
  for (let t = -fit.max; t <= fit.max; t += fit.step) {
    ticks.push(t);
  }

  return { min: -fit.max, max: fit.max, step: fit.step, ticks };
};
