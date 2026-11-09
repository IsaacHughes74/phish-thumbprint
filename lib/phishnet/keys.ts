import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Sort and encode order params into a canonical, order-independent string
 * (`order_by`, `direction`, `limit`). Used both to build the request URL and
 * to key the cache so two equivalent requests share one entry (AD-3).
 */
export function canonicalizeParams(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(
      ([, value]) => value !== undefined && value !== null && value.trim() !== '',
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Build the phish.net v5 request path for a single-column exact match
 * (`/{method}/{column}/{value}.json`) or an unfiltered method call
 * (`/{method}.json`) when `column` is empty — plus any canonical order params.
 */
export function buildRequestPath(
  method: string,
  column: string,
  value: string,
  params: Record<string, string> = {},
): string {
  const query = canonicalizeParams(params);
  const segment = column ? `/${column}/${value}` : '';
  return `/${method}${segment}.json${query ? `?${query}` : ''}`;
}

/**
 * Cache key for a path request: a sha256 of the full request path (method +
 * column + value + order params), namespaced by method. Two requests that hit
 * the same phish.net endpoint share one cache row.
 */
export function pathCacheKey(
  method: string,
  column: string,
  value: string,
  params: Record<string, string> = {},
): string {
  return `${method}:${sha256(buildRequestPath(method, column, value, params))}`;
}
