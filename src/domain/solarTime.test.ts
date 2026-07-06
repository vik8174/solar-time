import { describe, it, expect } from 'vitest';

import {
  longitudeOffsetMinutes,
  equationOfTimeMinutes,
  offsetMinutes,
  standardOffsetMinutes,
  dstMinutes,
  computeDeviation,
} from './solarTime';

const SOLAR_NOON_IDEAL = 720; // 12:00 in minutes from local midnight.

/** UTC noon on a given calendar day — the conventional sampling point for EoT. */
const utcNoon = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

/**
 * Sign convention across the whole module:
 * `+` means the official clock runs AHEAD of the apparent sun
 * (true solar noon happens AFTER 12:00). West-of-meridian → positive.
 */
describe('longitudeOffsetMinutes', () => {
  it('is zero exactly on the zone standard meridian', () => {
    // 15°E is the standard meridian of a UTC+1 (60 min) zone.
    expect(longitudeOffsetMinutes(15, 60)).toBeCloseTo(0, 6);
  });

  it('is positive west of the meridian (sun arrives later, clock ahead)', () => {
    // Greenwich (0°) sitting inside a UTC+1 zone: 15° west → +60 min.
    expect(longitudeOffsetMinutes(0, 60)).toBeCloseTo(60, 6);
  });

  it('is negative east of the meridian (sun arrives earlier, clock behind)', () => {
    // 30°E inside a UTC+1 zone: 15° east → −60 min.
    expect(longitudeOffsetMinutes(30, 60)).toBeCloseTo(-60, 6);
  });
});

/**
 * Classic equation of time = apparent solar time − mean solar time (minutes).
 * Anchors are year-independent published extremes/zero-crossings; the ±0.5 min
 * tolerance is the <30 s accuracy target from the acceptance criteria.
 */
describe('equationOfTimeMinutes', () => {
  it('reaches its annual minimum (~−14.24 min) around Feb 11', () => {
    expect(equationOfTimeMinutes(utcNoon(2026, 2, 11))).toBeCloseTo(-14.24, 0);
    expect(equationOfTimeMinutes(utcNoon(2026, 2, 11))).toBeLessThan(-13.5);
  });

  it('reaches its annual maximum (~+16.42 min) around Nov 3', () => {
    expect(equationOfTimeMinutes(utcNoon(2026, 11, 3))).toBeCloseTo(16.42, 0);
    expect(equationOfTimeMinutes(utcNoon(2026, 11, 3))).toBeGreaterThan(15.5);
  });

  it('crosses zero in mid-April', () => {
    expect(equationOfTimeMinutes(utcNoon(2026, 4, 15))).toBeCloseTo(0, 0);
  });

  it('crosses zero at the start of September', () => {
    expect(equationOfTimeMinutes(utcNoon(2026, 9, 1))).toBeCloseTo(0, 0);
  });
});

/** Real IANA zones drive the offset helpers — no hardcoded numbers in the module. */
describe('timezone offsets via Intl', () => {
  const winter = utcNoon(2026, 1, 15);
  const summer = utcNoon(2026, 7, 15);

  it('reads the actual UTC offset in effect (CET in winter, CEST in summer)', () => {
    expect(offsetMinutes('Europe/Prague', winter)).toBe(60);
    expect(offsetMinutes('Europe/Prague', summer)).toBe(120);
  });

  it('returns the standard (non-DST) offset regardless of season', () => {
    expect(standardOffsetMinutes('Europe/Prague', winter)).toBe(60);
    expect(standardOffsetMinutes('Europe/Prague', summer)).toBe(60);
  });

  it('reports DST as the difference from standard: 0 in winter, +60 in summer', () => {
    expect(dstMinutes('Europe/Prague', winter)).toBe(0);
    expect(dstMinutes('Europe/Prague', summer)).toBe(60);
  });

  it('handles a zone that never observes DST (China, fixed UTC+8)', () => {
    expect(offsetMinutes('Asia/Shanghai', winter)).toBe(480);
    expect(standardOffsetMinutes('Asia/Shanghai', summer)).toBe(480);
    expect(dstMinutes('Asia/Shanghai', summer)).toBe(0);
  });

  it('handles a non-integer-hour DST shift (Lord Howe, +10:30 / +11:00)', () => {
    // Southern hemisphere: DST is active in January, standard in July.
    expect(standardOffsetMinutes('Australia/Lord_Howe', summer)).toBe(630);
    expect(dstMinutes('Australia/Lord_Howe', winter)).toBe(30);
    expect(dstMinutes('Australia/Lord_Howe', summer)).toBe(0);
  });

  it('fails fast on an invalid IANA zone id instead of returning NaN', () => {
    expect(() => offsetMinutes('Not/AZone', winter)).toThrow(RangeError);
  });
});

describe('computeDeviation', () => {
  it('breaks the deviation into three components that sum to total', () => {
    const date = utcNoon(2026, 1, 15); // Prague, winter → no DST.
    const result = computeDeviation({
      longitude: 14.42,
      timeZone: 'Europe/Prague',
      date,
    });

    // Each component is wired with the correct sign...
    expect(result.longitudeOffset).toBeCloseTo(longitudeOffsetMinutes(14.42, 60), 6);
    expect(result.dst).toBe(0);
    expect(result.equationOfTime).toBeCloseTo(-equationOfTimeMinutes(date), 6);

    // ...and the breakdown is strictly additive.
    expect(result.total).toBeCloseTo(
      result.longitudeOffset + result.equationOfTime + result.dst,
      6,
    );
  });

  it('places solar noon at 12:00 plus the total deviation', () => {
    const date = utcNoon(2026, 1, 15);
    const result = computeDeviation({
      longitude: 14.42,
      timeZone: 'Europe/Prague',
      date,
    });

    expect(result.solarNoon).toBeCloseTo(SOLAR_NOON_IDEAL + result.total, 6);
  });

  it('shows Madrid’s clock far ahead of the sun (Spain on CET, summer)', () => {
    // Madrid sits ~3.7° west of Greenwich yet runs CEST → solar noon ~14:30.
    const result = computeDeviation({
      longitude: -3.7,
      timeZone: 'Europe/Madrid',
      date: utcNoon(2026, 7, 15),
    });

    expect(result.dst).toBe(60);
    expect(result.total).toBeGreaterThan(120);
    // True solar noon lands early-to-mid afternoon (14:00–14:45).
    expect(result.solarNoon).toBeGreaterThan(840);
    expect(result.solarNoon).toBeLessThan(885);
  });

  it('captures Kashgar’s extreme deviation on Beijing time (one huge zone)', () => {
    // Westernmost China (~76°E) on UTC+8 → true solar noon near 15:00.
    const result = computeDeviation({
      longitude: 75.99,
      timeZone: 'Asia/Shanghai',
      date: utcNoon(2026, 1, 15),
    });

    expect(result.dst).toBe(0);
    expect(result.total).toBeGreaterThan(150);
    expect(result.solarNoon).toBeGreaterThan(880); // after 14:40
    expect(result.solarNoon).toBeLessThan(930); // before 15:30
  });

  // Antimeridian cities: West longitude but East UTC (+12/+13/+14) — they sit
  // just across the date line, so the raw longitude offset overflows by a full
  // day (1440 min). Solar time is cyclic; the deviation must wrap into range.
  it.each([
    // Raw offset ≈ +1481 min wraps down a full day to +40.8; likewise the others.
    {
      name: "Nuku'alofa",
      longitude: -175.2,
      timeZone: 'Pacific/Tongatapu',
      expectedLongitudeOffset: 40.8,
    },
    { name: 'Apia', longitude: -171.77, timeZone: 'Pacific/Apia', expectedLongitudeOffset: 27.08 },
    {
      name: 'Mata-Utu',
      longitude: -176.17,
      timeZone: 'Pacific/Wallis',
      expectedLongitudeOffset: -15.32,
    },
  ])(
    'wraps $name across the date line to its true small deviation',
    ({ longitude, timeZone, expectedLongitudeOffset }) => {
      const result = computeDeviation({ longitude, timeZone, date: utcNoon(2026, 1, 15) });

      // The wrapped longitude component is pinned to its true value — a full-day
      // (1440 min) overflow or a wrong wrap branch would miss this by ~1440.
      expect(result.longitudeOffset).toBeCloseTo(expectedLongitudeOffset, 2);
      // The marker no longer overflows the axis: WIDEST (720) suffices.
      expect(Math.abs(result.total)).toBeLessThan(720);
      // D-004 additive invariant survives the wrap (only one addend changed value).
      expect(result.longitudeOffset + result.equationOfTime + result.dst).toBeCloseTo(
        result.total,
        6,
      );
      // Solar noon stays anchored to the wrapped total.
      expect(result.solarNoon).toBeCloseTo(SOLAR_NOON_IDEAL + result.total, 6);
    },
  );

  it('is in sync on the standard meridian with no DST and near-zero EoT', () => {
    // 0°E in UTC+0 Iceland (no DST), mid-April EoT ≈ 0 → clock matches the sun.
    const result = computeDeviation({
      longitude: 0,
      timeZone: 'Atlantic/Reykjavik',
      date: utcNoon(2026, 4, 15),
    });

    expect(result.total).toBeCloseTo(0, 0); // within 0.5 min
    expect(result.solarNoon).toBeCloseTo(SOLAR_NOON_IDEAL, 0);
  });
});
