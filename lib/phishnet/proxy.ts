import { fetchPhishnet, type FetchLike } from './client';
import { canonicalizeParams, entityCacheKey, queryCacheKey, type EntityKind } from './keys';

const ENTITY_PATHS: Record<EntityKind, string> = {
  setlist: '/setlists',
  song: '/songs',
};

export interface PhishnetProxyDeps {
  fetch: FetchLike;
  readCache: (key: string) => Promise<unknown | undefined>;
  writeCache: (key: string, data: unknown) => Promise<void>;
  apiKey: string;
  baseUrl?: string;
}

/**
 * Read-through proxy for single-entity lookups (AD-3): cache hit returns the
 * cached JSON without a phish.net call; a miss fetches, stores, and returns.
 */
export async function getEntityCached(
  kind: EntityKind,
  id: string,
  deps: PhishnetProxyDeps,
): Promise<unknown> {
  const key = entityCacheKey(kind, id);

  const cached = await deps.readCache(key);
  if (cached !== undefined) {
    return cached;
  }

  const data = await fetchPhishnet(`${ENTITY_PATHS[kind]}/${id}`, {
    fetch: deps.fetch,
    apiKey: deps.apiKey,
    baseUrl: deps.baseUrl,
  });

  await deps.writeCache(key, data);
  return data;
}

/**
 * Read-through proxy for list/search/tour-date responses (AD-3), keyed on a
 * sha256 of their sorted query params.
 */
export async function getQueryCached(
  kind: string,
  params: Record<string, string>,
  deps: PhishnetProxyDeps,
): Promise<unknown> {
  const key = queryCacheKey(kind, params);

  const cached = await deps.readCache(key);
  if (cached !== undefined) {
    return cached;
  }

  const query = canonicalizeParams(params);
  const path = `/${kind}${query ? `?${query}` : ''}`;

  const data = await fetchPhishnet(path, {
    fetch: deps.fetch,
    apiKey: deps.apiKey,
    baseUrl: deps.baseUrl,
  });

  await deps.writeCache(key, data);
  return data;
}
