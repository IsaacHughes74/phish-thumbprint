import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_TTL_MS, isFresh } from './ttl';

test('CACHE_TTL_MS is within the phish.net 24h ceiling', () => {
  assert.ok(CACHE_TTL_MS <= 24 * 60 * 60 * 1000);
});

test('isFresh is true while within the TTL', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const fetchedAt = new Date(now.getTime() - 1000);
  assert.equal(isFresh(fetchedAt, now), true);
});

test('isFresh is false at or beyond the TTL', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const fetchedAt = new Date(now.getTime() - CACHE_TTL_MS);
  assert.equal(isFresh(fetchedAt, now), false);
});
