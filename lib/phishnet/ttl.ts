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
