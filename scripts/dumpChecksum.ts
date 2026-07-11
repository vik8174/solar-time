/**
 * dumpChecksum — pins the GeoNames dump so a regeneration can never silently
 * import upstream drift (R-016, layer 1). Pure and I/O-free: the caller
 * (`buildCities.ts`) reads the extracted dump + the pinned hash and does any
 * rewrite; everything reproducible and unit-testable lives here.
 *
 * The pin is a sha256 of the **extracted `cities5000.txt`** (not the `.zip` —
 * zip metadata such as timestamps isn't byte-stable). It is committed to
 * `scripts/cities5000.sha256` and reviewed like any other source.
 *
 * `GEONAMES_ACCEPT_DRIFT` is the sanctioned bump path: when set, the compare is
 * skipped and the pin is rewritten to the current hash. That's how a *future*
 * intentional refresh (#90) updates the pin — an explicit, reviewed act, never a
 * silent side effect.
 */

import { createHash } from 'node:crypto';

/**
 * Computes the lowercase hex sha256 of the given bytes. Pure — same input
 * always yields the same digest, no I/O.
 *
 * @param data - The bytes to hash (a `Buffer` of the extracted dump, or a string).
 * @returns The 64-char lowercase hex digest.
 */
export const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

/** What the caller should do after reconciling the current hash against the pin. */
export type ChecksumOutcome =
  /** Pin is present and equals the current hash — nothing to do. */
  | 'match'
  /** Caller should (over)write the pin file with the current hash. */
  | 'write';

/**
 * Pure decision for the dump-checksum gate. Never touches the filesystem — it
 * only compares the current hash against the pinned one and decides.
 *
 * - `acceptDrift` → always `'write'` (skip the compare; the sanctioned bump path).
 * - no pin yet (`pinned === undefined`) → **throws**: the pin must be created
 *   explicitly with `GEONAMES_ACCEPT_DRIFT=1`, never seeded silently.
 * - pin matches → `'match'`.
 * - pin differs → **throws loudly** with both hashes and the bump instruction.
 *
 * @param actual - sha256 of the freshly-extracted dump.
 * @param pinned - The committed pin, or `undefined` when the pin file is absent.
 * @param acceptDrift - Whether `GEONAMES_ACCEPT_DRIFT` sanctioned a bump.
 * @returns `'match'` (no-op) or `'write'` (caller rewrites the pin).
 * @throws When the dump drifted from a present pin, or no pin exists yet, and
 *   drift wasn't accepted.
 */
export const reconcileChecksum = (
  actual: string,
  pinned: string | undefined,
  acceptDrift: boolean,
): ChecksumOutcome => {
  if (acceptDrift) return 'write';
  if (pinned === undefined) {
    throw new Error(
      'No pinned GeoNames checksum (scripts/cities5000.sha256). ' +
        'Re-run with GEONAMES_ACCEPT_DRIFT=1 to create it.',
    );
  }
  if (pinned === actual) return 'match';
  throw new Error(
    `GeoNames dump changed (sha ${actual} ≠ pinned ${pinned}). ` +
      'Review the diff, then re-run with GEONAMES_ACCEPT_DRIFT=1 to bump the pin.',
  );
};
