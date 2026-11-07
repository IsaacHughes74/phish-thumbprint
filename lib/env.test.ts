import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, DEFAULT_BUST_OUT_GAP_THRESHOLD } from './env-core';

// These tests exercise the same `loadEnv` used by lib/env.ts's eager startup
// validation (and by instrumentation.ts), covering the spec's I/O & Edge-Case
// Matrix row: "Missing env -> app fails fast with a clear, non-secret error".
// Story 2 adds BETTER_AUTH_SECRET + BETTER_AUTH_URL to the required set; the
// Apple credentials are intentionally NOT required here (validated lazily).

const validEnv = {
  PHISHNET_API_KEY: 'test-key',
  DATABASE_URL: 'postgres://localhost/db',
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
};

test('loadEnv throws a clear error when PHISHNET_API_KEY is missing', () => {
  assert.throws(() => loadEnv({ ...validEnv, PHISHNET_API_KEY: '' }), /PHISHNET_API_KEY/);
});

test('loadEnv throws when DATABASE_URL is missing', () => {
  assert.throws(() => loadEnv({ ...validEnv, DATABASE_URL: '' }), /DATABASE_URL/);
});

test('loadEnv throws when BETTER_AUTH_SECRET is missing', () => {
  assert.throws(() => loadEnv({ ...validEnv, BETTER_AUTH_SECRET: undefined }), /BETTER_AUTH_SECRET/);
});

test('loadEnv throws when BETTER_AUTH_URL is missing', () => {
  assert.throws(() => loadEnv({ ...validEnv, BETTER_AUTH_URL: '   ' }), /BETTER_AUTH_URL/);
});

test('loadEnv reports every missing required variable', () => {
  assert.throws(() => loadEnv({}), /PHISHNET_API_KEY/);
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
  assert.throws(() => loadEnv({}), /BETTER_AUTH_SECRET/);
  assert.throws(() => loadEnv({}), /BETTER_AUTH_URL/);
});

test('loadEnv treats empty-string values as missing', () => {
  assert.throws(
    () => loadEnv({ ...validEnv, PHISHNET_API_KEY: '' }),
    /PHISHNET_API_KEY/,
  );
});

test('loadEnv never leaks a secret value in its error message', () => {
  const secret = 'super-secret-api-key-value';
  try {
    loadEnv({ ...validEnv, BETTER_AUTH_SECRET: secret, DATABASE_URL: '' });
    assert.fail('expected loadEnv to throw');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.equal(err.message.includes(secret), false);
  }
});

test('loadEnv returns a parsed Env with a default bust-out threshold', () => {
  const env = loadEnv(validEnv);
  assert.equal(env.PHISHNET_API_KEY, 'test-key');
  assert.equal(env.DATABASE_URL, 'postgres://localhost/db');
  assert.equal(env.BETTER_AUTH_SECRET, 'test-secret');
  assert.equal(env.BETTER_AUTH_URL, 'http://localhost:3000');
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, 50);
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, DEFAULT_BUST_OUT_GAP_THRESHOLD);
});

test('loadEnv parses a custom BUST_OUT_GAP_THRESHOLD', () => {
  const env = loadEnv({ ...validEnv, BUST_OUT_GAP_THRESHOLD: '25' });
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, 25);
});

test('loadEnv rejects a non-numeric BUST_OUT_GAP_THRESHOLD', () => {
  assert.throws(() => loadEnv({ ...validEnv, BUST_OUT_GAP_THRESHOLD: 'abc' }), /BUST_OUT_GAP_THRESHOLD/);
});

test('loadEnv rejects a negative BUST_OUT_GAP_THRESHOLD', () => {
  assert.throws(() => loadEnv({ ...validEnv, BUST_OUT_GAP_THRESHOLD: '-1' }), /BUST_OUT_GAP_THRESHOLD/);
});

test('loadEnv succeeds without Apple credentials (lazy sign-in validation)', () => {
  const env = loadEnv(validEnv);
  assert.equal(env.APPLE_CLIENT_ID, undefined);
  assert.equal(env.APPLE_TEAM_ID, undefined);
  assert.equal(env.APPLE_KEY_ID, undefined);
  assert.equal(env.APPLE_PRIVATE_KEY, undefined);
});

test('loadEnv surfaces Apple credentials when present', () => {
  const env = loadEnv({
    ...validEnv,
    APPLE_CLIENT_ID: 'com.example.app',
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY456',
    APPLE_PRIVATE_KEY: 'pk',
  });
  assert.equal(env.APPLE_CLIENT_ID, 'com.example.app');
  assert.equal(env.APPLE_TEAM_ID, 'TEAM123');
  assert.equal(env.APPLE_KEY_ID, 'KEY456');
  assert.equal(env.APPLE_PRIVATE_KEY, 'pk');
});
