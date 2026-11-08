import { fetchPhishnet, type FetchLike } from './client';
import { buildRequestPath, pathCacheKey } from './keys';

export interface PhishnetProxyDeps {
  fetch: FetchLike;
  readCache: (key: string) => Promise<unknown | undefined>;
  writeCache: (key: string, data: unknown) => Promise<void>;
  apiKey: string;
  baseUrl?: string;
}

/**
 * Read-through proxy for phish.net v5 path requests (AD-3): a cache hit
 * returns the cached JSON without a phish.net call; a miss fetches the path
 * (`/{method}/{column}/{value}.json`), stores, and returns. All calls funnel
 * through `fetchPhishnet`, so rate limits (code 4) and no-match (code 11) are
 * normalized in one place.
 */
export async function getPathCached(
  method: string,
  column: string,
  value: string,
  params: Record<string, string>,
  deps: PhishnetProxyDeps,
): Promise<unknown> {
  const key = pathCacheKey(method, column, value, params);

  const cached = await deps.readCache(key);
  if (cached !== undefined) {
    return cached;
  }

  const path = buildRequestPath(method, column, value, params);
  const data = await fetchPhishnet(path, {
    fetch: deps.fetch,
    apiKey: deps.apiKey,
    baseUrl: deps.baseUrl,
  });

  await deps.writeCache(key, data);
  return data;
}
