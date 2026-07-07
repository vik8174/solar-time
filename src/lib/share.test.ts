import { describe, expect, it } from 'vitest';

import { buildShareUrl, pickShareStrategy } from './share';

describe('pickShareStrategy', () => {
  it('prefers the native OS share sheet when the Web Share API is present', () => {
    expect(pickShareStrategy({ canShare: true, canClipboard: false })).toBe('native');
    // Native wins even when clipboard is also available (mobile with both).
    expect(pickShareStrategy({ canShare: true, canClipboard: true })).toBe('native');
  });

  it('falls back to clipboard copy when only the Clipboard API is present', () => {
    expect(pickShareStrategy({ canShare: false, canClipboard: true })).toBe('clipboard');
  });

  it('reports none when neither API is available, so the caller can hide the control', () => {
    expect(pickShareStrategy({ canShare: false, canClipboard: false })).toBe('none');
  });
});

describe('buildShareUrl', () => {
  it('builds a clean absolute URL from the origin and slug', () => {
    expect(buildShareUrl('prague', 'https://solar-time-prod.web.app')).toBe(
      'https://solar-time-prod.web.app/prague',
    );
  });

  it('produces a root-absolute path regardless of a trailing slash on the origin', () => {
    expect(buildShareUrl('madrid', 'https://solar-time-prod.web.app/')).toBe(
      'https://solar-time-prod.web.app/madrid',
    );
  });

  it('never carries a query string or fragment from the current address', () => {
    const url = buildShareUrl('kashgar', 'https://host.example');
    expect(url).toBe('https://host.example/kashgar');
    expect(url).not.toContain('?');
    expect(url).not.toContain('#');
  });

  it('throws on an invalid origin instead of returning a broken URL (fail fast)', () => {
    expect(() => buildShareUrl('prague', 'not-a-url')).toThrow();
  });
});
