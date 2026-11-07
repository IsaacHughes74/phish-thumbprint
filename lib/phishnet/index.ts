import 'server-only';
import { env } from '../env';
import { readCache, writeCache } from './cache';
import { getEntityCached, getQueryCached } from './proxy';
import type { FetchLike } from './client';

const fetchFn: FetchLike = (input, init) => globalThis.fetch(input, init);

const proxyDeps = {
  fetch: fetchFn,
  readCache,
  writeCache,
  apiKey: env.X_API_KEY,
};

/** phish.net setlist by show id (server-only, cached). */
export function getSetlist(showId: string): Promise<unknown> {
  return getEntityCached('setlist', showId, proxyDeps);
}

/** phish.net song by song id (server-only, cached). */
export function getSong(songId: string): Promise<unknown> {
  return getEntityCached('song', songId, proxyDeps);
}

/** phish.net list/search/tour-date query (server-only, cached). */
export function queryPhishnet(kind: string, params: Record<string, string>): Promise<unknown> {
  return getQueryCached(kind, params, proxyDeps);
}

export {
  RateLimitError,
  PhishnetError,
  PhishnetFetchError,
  RATE_LIMIT_CODE,
  isRateLimitError,
} from './errors';
export {
  entityCacheKey,
  queryCacheKey,
  canonicalizeParams,
  sha256,
  type EntityKind,
} from './keys';
