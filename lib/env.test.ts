import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, DEFAULT_BUST_OUT_GAP_THRESHOLD } from './env-core';

// These tests exercise the same `loadEnv` used by lib/env.ts's eager startup
// validation (and by instrumentation.ts), covering the spec's I/O & Edge-Case
// Matrix row: "Missing env -> app fails fast with a clear, non-secret error".

test('loadEnv throws a clear error when PHISHNET_API_KEY is missing', () => {
  assert.throws(() => loadEnv({ DATABASE_URL: 'postgres://localhost/db' }), /PHISHNET_API_KEY/);
});

test('loadEnv throws when DATABASE_URL is missing', () => {
  assert.throws(() => loadEnv({ 'PHISHNET_API_KEY': 'test-key' }), /DATABASE_URL/);
});

test('loadEnv reports every missing required variable', () => {
  assert.throws(() => loadEnv({}), /PHISHNET_API_KEY/);
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
});

test('loadEnv treats empty-string values as missing', () => {
  assert.throws(
    () => loadEnv({ 'PHISHNET_API_KEY': '', DATABASE_URL: 'postgres://x' }),
    /PHISHNET_API_KEY/,
  );
});

test('loadEnv never leaks a secret value in its error message', () => {
  const secret = 'super-secret-api-key-value';
  try {
    loadEnv({ 'PHISHNET_API_KEY': secret, DATABASE_URL: '' });
    assert.fail('expected loadEnv to throw');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.equal(err.message.includes(secret), false);
  }
});

test('loadEnv returns a parsed Env with a default bust-out threshold', () => {
  const env = loadEnv({
    'PHISHNET_API_KEY': 'test-key',
    DATABASE_URL: 'postgres://localhost/db',
  });
  assert.equal(env.PHISHNET_API_KEY, 'test-key');
  assert.equal(env.DATABASE_URL, 'postgres://localhost/db');
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, 50);
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, DEFAULT_BUST_OUT_GAP_THRESHOLD);
});

test('loadEnv parses a custom BUST_OUT_GAP_THRESHOLD', () => {
  const env = loadEnv({
    'PHISHNET_API_KEY': 'k',
    DATABASE_URL: 'postgres://localhost/db',
    BUST_OUT_GAP_THRESHOLD: '25',
  });
  assert.equal(env.BUST_OUT_GAP_THRESHOLD, 25);
});

test('loadEnv rejects a non-numeric BUST_OUT_GAP_THRESHOLD', () => {
  assert.throws(
    () =>
      loadEnv({
        'PHISHNET_API_KEY': 'k',
        DATABASE_URL: 'postgres://x',
        BUST_OUT_GAP_THRESHOLD: 'abc',
      }),
    /BUST_OUT_GAP_THRESHOLD/,
  );
});

test('loadEnv rejects a negative BUST_OUT_GAP_THRESHOLD', () => {
  assert.throws(
    () =>
      loadEnv({
        'PHISHNET_API_KEY': 'k',
        DATABASE_URL: 'postgres://x',
        BUST_OUT_GAP_THRESHOLD: '-1',
      }),
    /BUST_OUT_GAP_THRESHOLD/,
  );
});
