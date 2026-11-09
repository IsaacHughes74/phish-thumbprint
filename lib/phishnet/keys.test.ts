import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestPath, canonicalizeParams, pathCacheKey, sha256 } from './keys';

test('buildRequestPath builds a column-filtered .json path', () => {
  assert.equal(
    buildRequestPath('setlists', 'showid', '1252684412'),
    '/setlists/showid/1252684412.json',
  );
});

test('buildRequestPath appends canonical order params', () => {
  assert.equal(
    buildRequestPath('shows', 'artist', 'phish', { order_by: 'showdate' }),
    '/shows/artist/phish.json?order_by=showdate',
  );
});

test('buildRequestPath ignores empty order params', () => {
  assert.equal(
    buildRequestPath('shows', 'artist', 'phish', { order_by: 'showdate', direction: '' }),
    '/shows/artist/phish.json?order_by=showdate',
  );
});

test('buildRequestPath omits the column/value segment for an unfiltered call', () => {
  assert.equal(
    buildRequestPath('songs', '', '', { order_by: 'last_played', direction: 'DESC' }),
    '/songs.json?direction=DESC&order_by=last_played',
  );
});

test('pathCacheKey is a method-prefixed sha256 of the full path', () => {
  const key = pathCacheKey('setlists', 'showid', '123');
  assert.match(key, /^setlists:[0-9a-f]{64}$/);
  assert.equal(key, `setlists:${sha256('/setlists/showid/123.json')}`);
});

test('pathCacheKey differs for different column values', () => {
  const a = pathCacheKey('shows', 'showdate', '1997-11-22');
  const b = pathCacheKey('shows', 'showdate', '1997-11-23');
  assert.notEqual(a, b);
});

test('pathCacheKey is order-independent for order params', () => {
  const a = pathCacheKey('shows', 'artist', 'phish', { order_by: 'showdate', direction: 'ASC' });
  const b = pathCacheKey('shows', 'artist', 'phish', { direction: 'ASC', order_by: 'showdate' });
  assert.equal(a, b);
});

test('canonicalizeParams sorts keys and encodes values', () => {
  assert.equal(canonicalizeParams({ b: '2', a: '1' }), 'a=1&b=2');
});
