import { describe, expect, it } from 'vitest';

import { SUPPORT_DISMISSED, shouldShowSupport } from './supportVisibility';

describe('shouldShowSupport', () => {
  it('shows the support note when nothing has been stored yet', () => {
    expect(shouldShowSupport(null)).toBe(true);
  });

  it('hides the support note once it has been dismissed', () => {
    expect(shouldShowSupport(SUPPORT_DISMISSED)).toBe(false);
  });

  it('shows the note for any unrecognized stored value', () => {
    expect(shouldShowSupport('')).toBe(true);
    expect(shouldShowSupport('something-else')).toBe(true);
  });
});
