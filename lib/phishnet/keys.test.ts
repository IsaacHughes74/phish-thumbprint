import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeParams, entityCacheKey, queryCacheKey } from './keys';

test('entityCacheKey keys single-entity lookups on the phish.net id', () => {
  assert.equal(entityCacheKey('setlist', '1252684412'), 'setlist:1252684412');
  assert.equal(entityCacheKey('song', '139'), 'song:139');
});

test('entityCacheKey rejects an empty id', () => {
  assert.throws(() => entityCacheKey('setlist', '   '), /non-empty id/);
});

test('queryCacheKey is order-independent (sorted params -> sha256)', () => {
  const a = queryCacheKey('shows', { year: '2025', venue: 'Madison Square Garden' });
  const b = queryCacheKey('shows', { venue: 'Madison Square Garden', year: '2025' });
  assert.equal(a, b);
});

test('queryCacheKey differs for different params', () => {
  const a = queryCacheKey('shows', { year: '2025' });
  const b = queryCacheKey('shows', { year: '2024' });
  assert.notEqual(a, b);
});

test('queryCacheKey ignores empty param values', () => {
  const a = queryCacheKey('shows', { year: '2025', venue: '' });
  const b = queryCacheKey('shows', { year: '2025' });
  assert.equal(a, b);
});

test('canonicalizeParams sorts keys and encodes values', () => {
  assert.equal(canonicalizeParams({ b: '2', a: '1' }), 'a=1&b=2');
});
