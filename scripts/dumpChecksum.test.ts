import { describe, expect, it } from 'vitest';

import { reconcileChecksum, sha256 } from './dumpChecksum';

describe('sha256', () => {
  it('computes the known lowercase-hex digest of a string', () => {
    // Reference: `printf 'abc' | shasum -a 256`.
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes a Buffer identically to its string bytes (byte-stable)', () => {
    expect(sha256(Buffer.from('abc'))).toBe(sha256('abc'));
  });

  it('is sensitive to any change in the input', () => {
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });
});

describe('reconcileChecksum', () => {
  const HASH = 'a'.repeat(64);
  const OTHER = 'b'.repeat(64);

  it('returns "match" when the pin equals the current hash', () => {
    expect(reconcileChecksum(HASH, HASH, false)).toBe('match');
  });

  it('throws loudly when the dump drifted from a present pin', () => {
    // Message must carry both hashes and the sanctioned bump instruction.
    expect(() => reconcileChecksum(HASH, OTHER, false)).toThrow(
      /GeoNames dump changed .*GEONAMES_ACCEPT_DRIFT=1/s,
    );
  });

  it('throws when no pin exists yet and drift is not accepted', () => {
    expect(() => reconcileChecksum(HASH, undefined, false)).toThrow(
      /No pinned GeoNames checksum.*GEONAMES_ACCEPT_DRIFT=1/s,
    );
  });

  it('returns "write" under GEONAMES_ACCEPT_DRIFT, skipping the compare on a mismatch', () => {
    expect(reconcileChecksum(HASH, OTHER, true)).toBe('write');
  });

  it('returns "write" under GEONAMES_ACCEPT_DRIFT when no pin exists yet (first seed)', () => {
    expect(reconcileChecksum(HASH, undefined, true)).toBe('write');
  });
});
