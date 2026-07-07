import { describe, expect, it } from 'vitest';

import { readFirebaseConfig, readSentryDsn, type EnvRecord } from './analyticsEnv';

const fullFirebaseEnv: EnvRecord = {
  PUBLIC_FIREBASE_API_KEY: 'key-123',
  PUBLIC_FIREBASE_PROJECT_ID: 'solar-time-prod',
  PUBLIC_FIREBASE_APP_ID: '1:2:web:3',
  PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-ABC123',
  PUBLIC_FIREBASE_AUTH_DOMAIN: 'solar-time-prod.firebaseapp.com',
};

describe('readFirebaseConfig', () => {
  it('returns a config when every required key is present', () => {
    expect(readFirebaseConfig(fullFirebaseEnv)).toEqual({
      apiKey: 'key-123',
      projectId: 'solar-time-prod',
      appId: '1:2:web:3',
      measurementId: 'G-ABC123',
      authDomain: 'solar-time-prod.firebaseapp.com',
    });
  });

  it('omits authDomain when it is not provided (optional)', () => {
    const noAuth = { ...fullFirebaseEnv, PUBLIC_FIREBASE_AUTH_DOMAIN: undefined };
    expect(readFirebaseConfig(noAuth)).not.toHaveProperty('authDomain');
  });

  it('returns null when a required key is missing', () => {
    const partial = { ...fullFirebaseEnv, PUBLIC_FIREBASE_MEASUREMENT_ID: undefined };
    expect(readFirebaseConfig(partial)).toBeNull();
  });

  it('treats blank/whitespace values as missing', () => {
    expect(readFirebaseConfig({ ...fullFirebaseEnv, PUBLIC_FIREBASE_API_KEY: '   ' })).toBeNull();
  });

  it('returns null for an empty environment', () => {
    expect(readFirebaseConfig({})).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    expect(
      readFirebaseConfig({ ...fullFirebaseEnv, PUBLIC_FIREBASE_API_KEY: '  key-123  ' }),
    ).toEqual(expect.objectContaining({ apiKey: 'key-123' }));
  });
});

describe('readSentryDsn', () => {
  it('returns the DSN when configured', () => {
    expect(readSentryDsn({ PUBLIC_SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' })).toBe(
      'https://k@o.ingest.sentry.io/1',
    );
  });

  it('returns null when the DSN is absent', () => {
    expect(readSentryDsn({})).toBeNull();
  });

  it('returns null for a blank DSN', () => {
    expect(readSentryDsn({ PUBLIC_SENTRY_DSN: '  ' })).toBeNull();
  });
});
