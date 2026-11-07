import { createHash } from 'node:crypto';

/** Entity kinds whose cache keys are the phish.net id (AD-3). */
export type EntityKind = 'setlist' | 'song';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Sort and encode query params into a canonical, order-independent string. */
export function canonicalizeParams(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(
      ([, value]) => value !== undefined && value !== null && value.trim() !== '',
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/** Single-entity lookups key on the phish.net id: `setlist:<id>` / `song:<id>`. */
export function entityCacheKey(kind: EntityKind, id: string): string {
  const trimmed = id.trim();
  if (trimmed === '') {
    throw new Error('entityCacheKey requires a non-empty id');
  }
  return `${kind}:${trimmed}`;
}

/** List/search/tour-date responses key on a sha256 of their sorted query params. */
export function queryCacheKey(kind: string, params: Record<string, string>): string {
  return `${kind}:${sha256(canonicalizeParams(params))}`;
}
