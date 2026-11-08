import 'server-only';
import { env } from '../env';
import { readCache, writeCache } from './cache';
import { getPathCached } from './proxy';
import type { FetchLike } from './client';
import { searchShows as filterShows } from './search';
import type { SetlistRow, ShowRecord } from './types';

const fetchFn: FetchLike = (input, init) => globalThis.fetch(input, init);

const proxyDeps = {
  fetch: fetchFn,
  readCache,
  writeCache,
  apiKey: env.PHISHNET_API_KEY,
};

/** phish.net setlist by show id (server-only, cached) — one row per performance. */
export function getSetlist(showId: string): Promise<SetlistRow[]> {
  return getPathCached('setlists', 'showid', showId, {}, proxyDeps) as Promise<SetlistRow[]>;
}

/** phish.net song by song id (server-only, cached). */
export function getSong(songId: string): Promise<unknown> {
  return getPathCached('songs', 'songid', songId, {}, proxyDeps);
}

/**
 * The full Phish show catalog, ordered by showdate (server-only, cached ≤24h).
 * Serves the search-as-you-type picker: one cached request, filtered in-process
 * by `lib/phishnet/search`, never a per-keystroke phish.net call.
 */
export function getShowsCatalog(): Promise<ShowRecord[]> {
  return getPathCached(
    'shows',
    'artist',
    'phish',
    { order_by: 'showdate' },
    proxyDeps,
  ) as Promise<ShowRecord[]>;
}

/** Search the Phish catalog by a date/venue/city/state substring (server-only). */
export async function searchShows(query: string): Promise<ShowRecord[]> {
  if (!query.trim()) {
    return [];
  }
  const catalog = await getShowsCatalog();
  return filterShows(query, catalog);
}

export {
  RateLimitError,
  PhishnetError,
  PhishnetFetchError,
  RATE_LIMIT_CODE,
  NO_MATCH_ERROR_CODE,
  isRateLimitError,
} from './errors';
export {
  pathCacheKey,
  buildRequestPath,
  canonicalizeParams,
  sha256,
} from './keys';
export { matchesShowQuery, toMMDDYY } from './search';
export type { ShowRecord, SetlistRow } from './types';
