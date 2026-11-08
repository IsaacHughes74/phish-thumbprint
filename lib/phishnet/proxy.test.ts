import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPathCached } from './proxy';
import { pathCacheKey } from './keys';
import { PhishnetFetchError, RateLimitError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// I/O & Edge-Case Matrix coverage (path-based read-through proxy):
//   - cache hit  -> returns cached JSON, no phish.net call
//   - cache miss -> fetches the v5 path with X-API-KEY, stores, returns
//   - code 4     -> one typed RateLimitError, no write
//   - code 11    -> `[]` (normal no-match), cached
//   - order params -> built into the path + key (catalog request)

test('cache hit returns cached data without calling phish.net or writing', async () => {
  let fetchCalls = 0;
  let writeCalls = 0;
  const deps = {
    fetch: async () => {
      fetchCalls += 1;
      throw new Error('should not fetch on a cache hit');
    },
    readCache: async () => ({ cached: true }),
    writeCache: async () => {
      writeCalls += 1;
    },
    apiKey: 'test-key',
  };

  const result = await getPathCached('setlists', 'showid', '123', {}, deps);

  assert.deepEqual(result, { cached: true });
  assert.equal(fetchCalls, 0);
  assert.equal(writeCalls, 0);
});

test('cache miss fetches the v5 path with X-API-KEY, stores, and returns', async () => {
  const requests: { url: string; headers: Headers }[] = [];
  const written: Record<string, unknown> = {};
  const payload = { error: 0, error_message: '', data: { tracks: [{ song: 'Tweezer' }] } };

  const deps = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), headers: new Headers(init?.headers) });
      return jsonResponse(payload);
    },
    readCache: async () => undefined,
    writeCache: async (key: string, value: unknown) => {
      written[key] = value;
    },
    apiKey: 'test-key',
  };

  const result = await getPathCached('setlists', 'showid', '123', {}, deps);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.phish.net/v5/setlists/showid/123.json');
  assert.equal(requests[0].headers.get('X-API-KEY'), 'test-key');
  assert.deepEqual(result, payload.data);
  assert.deepEqual(written, { [pathCacheKey('setlists', 'showid', '123')]: payload.data });
});

test('order params are built into the request path and cache key', async () => {
  let capturedUrl = '';
  let capturedKey = '';
  const payload = { error: 0, error_message: '', data: [] };

  const deps = {
    fetch: async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return jsonResponse(payload);
    },
    readCache: async () => undefined,
    writeCache: async (key: string) => {
      capturedKey = key;
    },
    apiKey: 'test-key',
  };

  await getPathCached('shows', 'artist', 'phish', { order_by: 'showdate' }, deps);

  assert.equal(capturedUrl, 'https://api.phish.net/v5/shows/artist/phish.json?order_by=showdate');
  assert.equal(capturedKey, pathCacheKey('shows', 'artist', 'phish', { order_by: 'showdate' }));
});

test('phish.net code 4 surfaces a RateLimitError and never writes', async () => {
  let fetchCalls = 0;
  const deps = {
    fetch: async () => {
      fetchCalls += 1;
      return jsonResponse({ error: 4, error_message: 'rate limited', data: [] });
    },
    readCache: async () => undefined,
    writeCache: async () => {
      throw new Error('should not write on rate limit');
    },
    apiKey: 'test-key',
  };

  await assert.rejects(
    () => getPathCached('setlists', 'showid', '123', {}, deps),
    (err: unknown) => err instanceof RateLimitError,
  );
  assert.equal(fetchCalls, 1);
});

test('phish.net code 11 (no match) resolves to [] and is cached', async () => {
  const written: Record<string, unknown> = {};
  const deps = {
    fetch: async () => jsonResponse({ error: 11, error_message: 'No data matched', data: [] }),
    readCache: async () => undefined,
    writeCache: async (key: string, value: unknown) => {
      written[key] = value;
    },
    apiKey: 'test-key',
  };

  const result = await getPathCached('setlists', 'showid', '999999', {}, deps);

  assert.deepEqual(result, []);
  assert.deepEqual(written, { [pathCacheKey('setlists', 'showid', '999999')]: [] });
});

test('a non-4, non-11 phish.net error rethrows a typed PhishnetFetchError', async () => {
  const deps = {
    fetch: async () => jsonResponse({ error: 2, error_message: 'Invalid API Key', data: [] }),
    readCache: async () => undefined,
    writeCache: async () => {},
    apiKey: 'test-key',
  };

  await assert.rejects(
    () => getPathCached('setlists', 'showid', '123', {}, deps),
    (err: unknown) => err instanceof PhishnetFetchError,
  );
});
