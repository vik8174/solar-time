/**
 * scaleGeometry — maps the solar-noon deviation onto SVG pixel coordinates.
 * Pure: shared by the build-time render and the client recompute so both paint
 * the exact same axis, ticks and marker (no layout shift, single source).
 */

import { formatClock } from './format';
import { scaleWindow } from './scaleWindow';

/** Fixed SVG canvas — the root keeps these dimensions so nothing reflows. */
const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 96;
const PLOT_PADDING = 40;
const AXIS_Y = 58;
const IDEAL_NOON_MINUTES = 720; // 12:00, minutes from midnight — the axis origin.

/** One tick on the axis. */
export interface ScaleTick {
  /** X pixel position. */
  x: number;
  /** Signed offset from ideal noon, minutes. */
  offset: number;
  /** Clock label, e.g. "12:00". */
  label: string;
  /** True on the hour — those ticks are labelled and drawn taller. */
  major: boolean;
}

/** Fully resolved geometry for one render of the scale. */
export interface ScaleGeometry {
  width: number;
  height: number;
  axisY: number;
  plotMinX: number;
  plotMaxX: number;
  /** Ideal-noon reference marker (the brightest point). */
  ideal: { x: number };
  /** Solar-noon marker dot. */
  marker: { x: number; offset: number };
  ticks: ScaleTick[];
}

/**
 * Computes the scale geometry for a total deviation.
 *
 * @param totalMinutes - Signed clock-vs-sun deviation; drives the marker.
 * @returns Pixel coordinates for axis, ticks, ideal reference and marker.
 */
export const scaleGeometry = (totalMinutes: number): ScaleGeometry => {
  const { min, max, ticks } = scaleWindow(totalMinutes);
  const plotMinX = PLOT_PADDING;
  const plotMaxX = VIEW_WIDTH - PLOT_PADDING;
  const span = max - min;

  const xFor = (offset: number): number =>
    plotMinX + ((offset - min) / span) * (plotMaxX - plotMinX);

  return {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    axisY: AXIS_Y,
    plotMinX,
    plotMaxX,
    ideal: { x: xFor(0) },
    marker: { x: xFor(totalMinutes), offset: totalMinutes },
    ticks: ticks.map((offset) => ({
      x: xFor(offset),
      offset,
      label: formatClock(IDEAL_NOON_MINUTES + offset),
      major: (IDEAL_NOON_MINUTES + offset) % 60 === 0,
    })),
  };
};
