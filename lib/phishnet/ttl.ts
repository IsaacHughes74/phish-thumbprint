/**
 * phish.net requires cached responses to refresh within 24h; the shared TTL is
 * capped at that ceiling (AD-3: "one shared TTL policy, ≤ 24h").
 */

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isFresh(
  fetchedAt: Date,
  now: Date = new Date(),
  ttlMs: number = CACHE_TTL_MS,
): boolean {
  return now.getTime() - fetchedAt.getTime() < ttlMs;
}

export interface CacheEntry<T = unknown> {
  data: T;
  fetchedAt: Date;
}

/**
 * Keep-vs-drop decision for a read-through cache row: return the payload when
 * the row is present and still fresh, otherwise `undefined` (so a stale row is
 * refetched). `readCache` delegates to this so the 24h ceiling is covered by
 * unit tests without a live database.
 */
export function resolveCacheEntry<T = unknown>(
  row: CacheEntry<T> | undefined,
  now: Date = new Date(),
  ttlMs: number = CACHE_TTL_MS,
): T | undefined {
  if (!row || !isFresh(row.fetchedAt, now, ttlMs)) {
    return undefined;
  }
  return row.data;
}
