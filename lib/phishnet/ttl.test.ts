import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_TTL_MS, isFresh, resolveCacheEntry } from './ttl';

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

test('resolveCacheEntry returns the payload for a fresh row', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const entry = { data: { setlist: true }, fetchedAt: new Date(now.getTime() - 1000) };
  assert.deepEqual(resolveCacheEntry(entry, now), { setlist: true });
});

test('resolveCacheEntry returns undefined for a stale row past the 24h ceiling', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const entry = { data: { setlist: true }, fetchedAt: new Date(now.getTime() - CACHE_TTL_MS) };
  assert.equal(resolveCacheEntry(entry, now), undefined);
});

test('resolveCacheEntry returns undefined for a missing row', () => {
  assert.equal(resolveCacheEntry(undefined), undefined);
});
