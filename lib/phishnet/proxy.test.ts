import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEntityCached, getQueryCached } from './proxy';
import { PhishnetFetchError, RateLimitError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// I/O & Edge-Case Matrix coverage:
//   - "Proxy cache hit"     -> returns cached JSON, no phish.net call
//   - "Proxy cache miss"    -> fetch via X-API-KEY, store, return
//   - "Rate limited" (code 4) -> one typed RateLimitError, no retry
//   - non-4 error           -> rethrow typed PhishnetFetchError

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

  const result = await getEntityCached('setlist', '123', deps);

  assert.deepEqual(result, { cached: true });
  assert.equal(fetchCalls, 0);
  assert.equal(writeCalls, 0);
});

test('cache miss fetches phish.net v5 with X-API-KEY header, stores, and returns', async () => {
  const requests: { url: string; headers: Headers }[] = [];
  const written: Record<string, unknown> = {};
  const payload = { success: 1, error_code: 0, data: { tracks: [{ title: 'Tweezer' }] } };

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

  const result = await getEntityCached('setlist', '123', deps);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.phish.net/v5/setlists/123');
  assert.equal(requests[0].headers.get('X-API-KEY'), 'test-key');
  assert.deepEqual(written, { 'setlist:123': payload.data });
  assert.deepEqual(result, payload.data);
});

test('phish.net code 4 surfaces a single typed RateLimitError and never retries', async () => {
  let fetchCalls = 0;
  const deps = {
    fetch: async () => {
      fetchCalls += 1;
      return jsonResponse({ success: 0, error_code: 4, error_message: 'rate limited' });
    },
    readCache: async () => undefined,
    writeCache: async () => {
      throw new Error('should not write on rate limit');
    },
    apiKey: 'test-key',
  };

  await assert.rejects(
    () => getEntityCached('setlist', '123', deps),
    (err: unknown) => err instanceof RateLimitError,
  );
  assert.equal(fetchCalls, 1);
});

test('a non-4 phish.net error rethrows a typed PhishnetFetchError', async () => {
  const deps = {
    fetch: async () => jsonResponse({ success: 0, error_code: 2, error_message: 'not found' }),
    readCache: async () => undefined,
    writeCache: async () => {},
    apiKey: 'test-key',
  };

  await assert.rejects(
    () => getEntityCached('setlist', '123', deps),
    (err: unknown) => err instanceof PhishnetFetchError,
  );
});

test('an HTTP error surfaces a typed PhishnetFetchError', async () => {
  const deps = {
    fetch: async () => jsonResponse({}, 500),
    readCache: async () => undefined,
    writeCache: async () => {},
    apiKey: 'test-key',
  };

  await assert.rejects(
    () => getEntityCached('setlist', '123', deps),
    (err: unknown) => err instanceof PhishnetFetchError,
  );
});

test('query cache miss builds a sorted query string', async () => {
  let capturedUrl = '';
  let capturedKey = '';
  const payload = { success: 1, error_code: 0, data: { shows: [] } };

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

  await getQueryCached('shows', { year: '2025', venue: 'MSG' }, deps);

  assert.equal(capturedUrl, 'https://api.phish.net/v5/shows?venue=MSG&year=2025');
  assert.match(capturedKey, /^shows:[0-9a-f]{64}$/);
});
