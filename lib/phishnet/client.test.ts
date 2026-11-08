import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPhishnet } from './client';
import { PhishnetFetchError, RateLimitError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deps(body: unknown, status = 200) {
  return {
    fetch: async () => jsonResponse(body, status),
    apiKey: 'test-key',
  };
}

// I/O & Edge-Case Matrix coverage (phish.net v5 envelope):
//   - success `error: 0` and `error: false` -> returns `data`
//   - code 4 -> one typed RateLimitError
//   - code 11 ("no data matched") -> `[]`, a normal result
//   - other non-zero code -> PhishnetFetchError with code + message

test('v5 success (error: 0) returns data', async () => {
  const data = [{ showid: 1251937496 }];
  const result = await fetchPhishnet('/shows/showdate/1997-11-22.json', deps({ error: 0, error_message: '', data }));
  assert.deepEqual(result, data);
});

test('v5 success (error: false boolean) returns data', async () => {
  const data = [{ showid: 1251937496 }];
  const result = await fetchPhishnet('/shows/showdate/1997-11-22.json', deps({ error: false, error_message: '', data }));
  assert.deepEqual(result, data);
});

test('v5 code 4 surfaces a RateLimitError', async () => {
  await assert.rejects(
    () => fetchPhishnet('/shows/artist/phish.json', deps({ error: 4, error_message: 'Rate limit has been reached', data: [] })),
    (err: unknown) => err instanceof RateLimitError,
  );
});

test('v5 code 11 (no data matched) resolves to an empty array', async () => {
  const result = await fetchPhishnet(
    '/setlists/showid/999999.json',
    deps({ error: 11, error_message: 'No data matched your query', data: [] }),
  );
  assert.deepEqual(result, []);
});

test('v5 other non-zero error code raises a PhishnetFetchError with code + message', async () => {
  await assert.rejects(
    () => fetchPhishnet('/shows/artist/phish.json', deps({ error: 2, error_message: 'Invalid API Key', data: [] })),
    (err: unknown) => err instanceof PhishnetFetchError && /code 2/.test(err.message) && /Invalid API Key/.test(err.message),
  );
});

test('an HTTP error surfaces a typed PhishnetFetchError', async () => {
  await assert.rejects(
    () => fetchPhishnet('/shows/artist/phish.json', deps({}, 500)),
    (err: unknown) => err instanceof PhishnetFetchError,
  );
});

test('a rejected fetch is wrapped with the cause', async () => {
  const networkError = new TypeError('fetch failed');
  await assert.rejects(
    () =>
      fetchPhishnet('/shows/artist/phish.json', {
        fetch: async () => {
          throw networkError;
        },
        apiKey: 'test-key',
      }),
    (err: unknown) => err instanceof PhishnetFetchError && err.cause === networkError,
  );
});
