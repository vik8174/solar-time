/**
 * apportionMinutes — pure largest-remainder (Hamilton) rounding for an additive
 * breakdown, so the rounded parts sum EXACTLY to the rounded total.
 *
 * Rounding each component independently can make the shown parts disagree with
 * the shown total (e.g. +2 +4 +60 = 66 against a +67 total). This rounds every
 * component to the nearest whole minute, then hands the leftover ±1s to the
 * components whose fractional remainder is closest to flipping — the classic
 * apportionment fix, generalised to signed values.
 *
 * Display-only: it never touches the unrounded domain values, so the additive
 * invariant `longitudeOffset + equationOfTime + dst === total` (D-004) still
 * holds on the raw numbers.
 */

/**
 * Rounds additive components so they sum to their rounded total.
 *
 * The target is the components' own rounded sum — derived here rather than
 * passed in, so a mismatched total is unrepresentable. With the exact sum as
 * target, the leftover to redistribute is at most ±1 per extra component, so
 * each part moves by at most one minute from its naive rounding.
 *
 * @param components - Raw signed minute values (may be fractional).
 * @returns Whole-minute integers, one per component in order, summing to
 *   `Math.round(sum(components))`.
 */
export const apportionMinutes = (components: readonly number[]): number[] => {
  // Residual = how far each raw value sits above its rounded integer, (-0.5, 0.5].
  const parts = components.map((raw) => {
    const rounded = Math.round(raw);
    return { raw, rounded, residual: raw - rounded };
  });

  const target = Math.round(parts.reduce((sum, p) => sum + p.raw, 0));
  const drift = target - parts.reduce((sum, p) => sum + p.rounded, 0);
  if (drift !== 0) {
    const step = drift > 0 ? 1 : -1;
    // When we owe minutes (drift > 0) bump the components nearest to rounding up
    // (largest residual first); when we have overshot, dock those rounded up
    // hardest (smallest residual first). Array.sort is stable, so equal
    // residuals keep input order — a deterministic tie-break by position.
    const order = [...parts].sort((a, b) =>
      drift > 0 ? b.residual - a.residual : a.residual - b.residual,
    );
    for (let k = 0; k < Math.abs(drift); k++) {
      // `if (part)` only satisfies TS's indexed-access check; k < |drift| ≤
      // parts.length here, so the index is always in range and never wraps.
      const part = order[k % order.length];
      if (part) part.rounded += step;
    }
  }

  // `+ 0` normalises a possible -0 (from Math.round of a tiny negative) to 0.
  return parts.map((p) => p.rounded + 0);
};
