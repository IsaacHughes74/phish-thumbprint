/**
 * Typed errors for the phish.net proxy (AD-3). phish.net code 4 is normalized
 * into a single RateLimitError so callers never branch on raw codes.
 */

export const RATE_LIMIT_CODE = 4;

/**
 * phish.net v5 code for "no data matched your query". Distinct from a real
 * failure: a no-match is a normal result and the proxy surfaces it as `[]`.
 */
export const NO_MATCH_ERROR_CODE = 11;

export class PhishnetError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class RateLimitError extends PhishnetError {
  constructor(message = `phish.net rate limit exceeded (code ${RATE_LIMIT_CODE})`) {
    super(message);
  }
}

export class PhishnetFetchError extends PhishnetError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
