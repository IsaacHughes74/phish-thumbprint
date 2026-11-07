import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { phishCache } from '../../db/schema';
import { isFresh } from './ttl';

export async function readCache(key: string): Promise<unknown | undefined> {
  const rows = await db
    .select()
    .from(phishCache)
    .where(eq(phishCache.key, key))
    .limit(1);

  const row = rows[0];
  if (!row || !isFresh(row.fetchedAt)) {
    return undefined;
  }
  return row.data;
}

export async function writeCache(key: string, data: unknown): Promise<void> {
  const fetchedAt = new Date();
  await db
    .insert(phishCache)
    .values({ key, data, fetchedAt })
    .onConflictDoUpdate({ target: phishCache.key, set: { data, fetchedAt } });
}
