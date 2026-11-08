import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { showHistory } from '../db/schema';
import {
  addShowToHistory as addShowToHistoryCore,
  getShowHistory as getShowHistoryCore,
  removeShowFromHistory as removeShowFromHistoryCore,
  type AddShowInput,
  type HistoryDeps,
  type ShowHistoryRow,
} from './history-core';

/**
 * Server-only Show History (AD-2): the only write surfaces are `addShowToHistory`
 * and `removeShowToHistory`, both deduping on the `(user_id, phishnet_show_id)`
 * unique constraint. Importing this module fails the build from a Client
 * Component (AD-1 server-only boundary). The logic itself lives in
 * `history-core.ts`, dep-injected so it is unit-tested without a live database.
 */

const deps: HistoryDeps = {
  listByUser: async (userId) => {
    const rows = await db
      .select()
      .from(showHistory)
      .where(eq(showHistory.userId, userId));
    return rows.map<ShowHistoryRow>((row) => ({
      id: row.id,
      userId: row.userId,
      phishnetShowId: row.phishnetShowId,
      phishnetVenueId: row.phishnetVenueId,
      showDate: row.showDate,
      venueLabel: row.venueLabel,
    }));
  },

  insertShow: async (input) => {
    const inserted = await db
      .insert(showHistory)
      .values({
        userId: input.userId,
        phishnetShowId: input.showId,
        phishnetVenueId: input.venueId,
        showDate: input.showDate,
        venueLabel: input.venueLabel,
      })
      .onConflictDoNothing({
        target: [showHistory.userId, showHistory.phishnetShowId],
      })
      .returning({ id: showHistory.id });
    return { inserted: inserted.length > 0 };
  },

  deleteShow: async (userId, showId) => {
    const deleted = await db
      .delete(showHistory)
      .where(
        and(
          eq(showHistory.userId, userId),
          eq(showHistory.phishnetShowId, showId),
        ),
      )
      .returning({ id: showHistory.id });
    return { deleted: deleted.length > 0 };
  },
};

export function getShowHistory(userId: string): Promise<ShowHistoryRow[]> {
  return getShowHistoryCore(userId, deps);
}

export function addShowToHistory(
  input: AddShowInput,
): Promise<'added' | 'duplicate'> {
  return addShowToHistoryCore(input, deps);
}

export function removeShowFromHistory(
  userId: string,
  showId: string,
): Promise<boolean> {
  return removeShowFromHistoryCore(userId, showId, deps);
}
