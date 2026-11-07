import { PhishnetFetchError, RateLimitError, RATE_LIMIT_CODE } from './errors';

export const PHISHNET_BASE_URL = 'https://api.phish.net/v5';

/** A narrow, test-friendly fetch signature (avoids `typeof globalThis.fetch`'s overloads). */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface PhishnetResponse {
  success: number;
  data: unknown;
  error_code: number;
  error_message?: string;
}

export interface PhishnetClientDeps {
  fetch: FetchLike;
  apiKey: string;
  baseUrl?: string;
}

/**
 * The single fetch path to phish.net v5 (AD-3): the key is sent server-side as
 * an `X-API-KEY` header. phish.net code 4 is normalized into a RateLimitError;
 * any other failure (network, HTTP, non-zero error_code) is surfaced as a
 * typed PhishnetFetchError.
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

  if (body.error_code === RATE_LIMIT_CODE) {
    throw new RateLimitError(`phish.net rate limit exceeded (code ${RATE_LIMIT_CODE})`);
  }

  if (body.success === 0) {
    throw new PhishnetFetchError(
      `phish.net error code ${body.error_code}: ${body.error_message ?? 'unknown error'}`,
    );
  }

  return body.data as T;
}
