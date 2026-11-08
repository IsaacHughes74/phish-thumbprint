import {
  NO_MATCH_ERROR_CODE,
  PhishnetFetchError,
  RateLimitError,
  RATE_LIMIT_CODE,
} from './errors';

export const PHISHNET_BASE_URL = 'https://api.phish.net/v5';

/** A narrow, test-friendly fetch signature (avoids `typeof globalThis.fetch`'s overloads). */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * phish.net v5 response envelope. On success `error` is `0` (the JSON literal
 * `false` also appears in some responses, so it is treated as success too);
 * on failure it is a numeric code (see `errors.ts`). `data` is always a list.
 */
export interface PhishnetResponse {
  error: number | boolean;
  error_message?: string;
  data: unknown;
}

export interface PhishnetClientDeps {
  fetch: FetchLike;
  apiKey: string;
  baseUrl?: string;
}

/**
 * The single fetch path to phish.net v5 (AD-3): the key is sent server-side as
 * an `X-API-KEY` header. Code `4` is normalized into a RateLimitError; code
 * `11` ("no data matched") is a normal empty result and returns `[]`; any
 * other non-zero error is surfaced as a typed PhishnetFetchError with its code
 * and message.
 */
export async function fetchPhishnet<T = unknown>(
  path: string,
  deps: PhishnetClientDeps,
): Promise<T> {
  const baseUrl = deps.baseUrl ?? PHISHNET_BASE_URL;
  const url = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await deps.fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-KEY': deps.apiKey,
      },
    });
  } catch (cause) {
    throw new PhishnetFetchError(
      `phish.net request failed: ${cause instanceof Error ? cause.message : 'network error'}`,
      { cause },
    );
  }

  if (!response.ok) {
    throw new PhishnetFetchError(`phish.net responded with HTTP ${response.status}`);
  }

  let body: PhishnetResponse;
  try {
    body = (await response.json()) as PhishnetResponse;
  } catch (cause) {
    throw new PhishnetFetchError(
      `phish.net returned invalid JSON: ${cause instanceof Error ? cause.message : 'parse error'}`,
      { cause },
    );
  }

  if (body === null || typeof body !== 'object') {
    throw new PhishnetFetchError('phish.net returned an unexpected non-object response body');
  }

  const error = body.error;

  if (error === RATE_LIMIT_CODE) {
    throw new RateLimitError(`phish.net rate limit exceeded (code ${RATE_LIMIT_CODE})`);
  }

  // "No data matched" is a normal outcome for a search or a show with no
  // setlist rows — surface it as an empty list, not an error (AD-3 / FR-5).
  if (error === NO_MATCH_ERROR_CODE) {
    return [] as unknown as T;
  }

  // Success: `error` is `0`, or the JSON literal `false` (both documented by
  // phish.net for a healthy response).
  if (error !== 0 && error !== false) {
    throw new PhishnetFetchError(
      `phish.net error code ${String(error)}: ${body.error_message ?? 'unknown error'}`,
    );
  }

  return body.data as T;
}
