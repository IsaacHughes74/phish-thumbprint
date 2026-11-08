/**
 * Pure, dependency-free core of Show History (AD-2): list/add/remove the Shows
 * a Phan recorded. Split from `lib/history.ts` (which adds `server-only` and
 * wires the real Drizzle queries) so the dedupe/remove/ordering logic is
 * unit-testable without a live database — the same seam `lib/resolve-user.ts`
 * and `lib/env-core.ts` use.
 *
 * Show History is the single source of truth (AD-2); the only write surfaces
 * are `addShowToHistory` / `removeShowToHistory`, and duplicate-show
 * prevention is the DB `(user_id, phishnet_show_id)` unique constraint, which
 * the insert dependency reports back as `inserted: false`.
 */

/** A `SHOW_HISTORY` row, decoupled from the Drizzle table shape. */
export interface ShowHistoryRow {
  id: string;
  userId: string;
  phishnetShowId: string;
  phishnetVenueId: string;
  /** ISO-8601 `date` string ("YYYY-MM-DD"). */
  showDate: string;
  venueLabel: string;
}

export interface AddShowInput {
  userId: string;
  showId: string;
  venueId: string;
  showDate: string;
  venueLabel: string;
}

export interface HistoryDeps {
  /** All rows for a user, any order (the core sorts newest-first). */
  listByUser: (userId: string) => Promise<ShowHistoryRow[]>;
  /**
   * Insert one row. Returns `inserted: false` when the `(user_id,
   * phishnet_show_id)` unique constraint rejected a duplicate (onConflictDoNothing).
   */
  insertShow: (input: AddShowInput) => Promise<{ inserted: boolean }>;
  /** Delete the row for `(user_id, phishnet_show_id)`; `deleted` reflects a hit. */
  deleteShow: (userId: string, showId: string) => Promise<{ deleted: boolean }>;
}

function byNewestFirst(a: ShowHistoryRow, b: ShowHistoryRow): number {
  const date = b.showDate.localeCompare(a.showDate);
  if (date !== 0) {
    return date;
  }
  return b.phishnetShowId.localeCompare(a.phishnetShowId);
}

/** The Phan's recorded Shows, chronological (newest first), per FR-7. */
export async function getShowHistory(
  userId: string,
  deps: HistoryDeps,
): Promise<ShowHistoryRow[]> {
  const rows = await deps.listByUser(userId);
  return [...rows].sort(byNewestFirst);
}

/**
 * Add a Show. Returns `'added'` on success and `'duplicate'` when the row was
 * already present (the unique constraint, not a UI check — AD-2 / FR-8).
 */
export async function addShowToHistory(
  input: AddShowInput,
  deps: HistoryDeps,
): Promise<'added' | 'duplicate'> {
  const { inserted } = await deps.insertShow(input);
  return inserted ? 'added' : 'duplicate';
}

/** Remove a Show; returns `true` when a row was actually deleted (FR-6). */
export async function removeShowFromHistory(
  userId: string,
  showId: string,
  deps: HistoryDeps,
): Promise<boolean> {
  const { deleted } = await deps.deleteShow(userId, showId);
  return deleted;
}
