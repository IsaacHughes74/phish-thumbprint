import 'server-only';

import type { ShowHistoryRow } from './history-core';
import { getSetlist, getShowsCatalog, getSongsCatalog } from './phishnet';
import type { SetlistRow, ShowRecord, SongRecord } from './phishnet/types';
import {
  chaseList,
  deriveTasteProfile,
  tailoredPicks,
  type ChaseAnchor,
  type ChaseEntry,
  type TailoredPick,
} from './recommend-core';

/**
 * Server-only Tailored Picks (AD-1 / AD-2 / AD-4): take the Phan's Show History
 * (already fetched by the page for its empty-state check), pull every Show's
 * cached Setlist and the song catalog through the single phish.net proxy
 * (AD-3), then derive picks with the pure `recommend-core`. Importing this
 * module from a Client Component fails the build (AD-1).
 *
 * Mirrors `lib/stats.ts`: a missing/empty/rate-limited Setlist or catalog fetch
 * is swallowed and sets `degraded` (EXPERIENCE §State Patterns: never block
 * reading), so picks degrade to empty rather than a broken Report.
 */
export interface TailoredPicksResult {
  picks: TailoredPick[];
  /** True when a Setlist or song-catalog fetch failed (rate limit or otherwise) — picks are incomplete. */
  degraded: boolean;
}

export async function getTailoredPicks(
  history: ShowHistoryRow[],
): Promise<TailoredPicksResult> {
  let degraded = false;

  const setlistEntries = await Promise.all(
    history.map(
      async (row): Promise<[string, SetlistRow[]]> => {
        try {
          return [row.phishnetShowId, await getSetlist(row.phishnetShowId)];
        } catch (error) {
          // Swallow setlist errors (FR-5): the Show stays, the rows are empty.
          degraded = true;
          console.error(
            `getTailoredPicks: setlist fetch failed for show ${row.phishnetShowId}`,
            error,
          );
          return [row.phishnetShowId, []];
        }
      },
    ),
  );

  const setlistsByShow: Record<string, SetlistRow[]> = {};
  for (const [showId, rows] of setlistEntries) {
    setlistsByShow[showId] = rows;
  }

  let catalog: SongRecord[];
  try {
    catalog = await getSongsCatalog();
  } catch (error) {
    // Picks degrade to empty rather than a broken Report.
    degraded = true;
    console.error('getTailoredPicks: song catalog fetch failed', error);
    catalog = [];
  }

  const profile = deriveTasteProfile(setlistsByShow, catalog);
  const picks = tailoredPicks(profile, catalog);

  return { picks, degraded };
}

export interface ChaseListResult {
  anchor: ChaseAnchor;
  entries: ChaseEntry[];
  /** True when a Setlist, song-catalog, or shows-catalog fetch failed — entries are incomplete. */
  degraded: boolean;
}

/** The server's current UTC date as "YYYY-MM-DD" — the anchor inference `today`. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Server-only Chase List (AD-1 / AD-2 / AD-3 / AD-4): a second caller of the
 * shared ranker and writer seam. Fetch every Show's Setlist, the song catalog,
 * and the shows catalog through the single phish.net proxy (AD-3), then derive
 * the Chase List with the pure `recommend-core`. The anchor is inferred at read
 * from the shows catalog (`inferChaseAnchor`), never persisted (AD-2). Importing
 * this module from a Client Component fails the build (AD-1).
 *
 * Mirrors `getTailoredPicks` and `lib/stats.ts`: any failed fetch is swallowed
 * and sets `degraded` (EXPERIENCE §State Patterns: never block reading), so the
 * Chase List degrades to empty rather than a broken Report.
 */
export async function getChaseList(
  history: ShowHistoryRow[],
): Promise<ChaseListResult> {
  let degraded = false;

  const setlistEntries = await Promise.all(
    history.map(
      async (row): Promise<[string, SetlistRow[]]> => {
        try {
          return [row.phishnetShowId, await getSetlist(row.phishnetShowId)];
        } catch (error) {
          degraded = true;
          console.error(
            `getChaseList: setlist fetch failed for show ${row.phishnetShowId}`,
            error,
          );
          return [row.phishnetShowId, []];
        }
      },
    ),
  );

  const setlistsByShow: Record<string, SetlistRow[]> = {};
  for (const [showId, rows] of setlistEntries) {
    setlistsByShow[showId] = rows;
  }

  let catalog: SongRecord[];
  try {
    catalog = await getSongsCatalog();
  } catch (error) {
    degraded = true;
    console.error('getChaseList: song catalog fetch failed', error);
    catalog = [];
  }

  let shows: ShowRecord[];
  try {
    shows = await getShowsCatalog();
  } catch (error) {
    // A missing shows catalog hides the anchor (inferChaseAnchor -> none); the
    // entries still degrade to empty rather than a broken Report.
    degraded = true;
    console.error('getChaseList: shows catalog fetch failed', error);
    shows = [];
  }

  const profile = deriveTasteProfile(setlistsByShow, catalog);
  const { anchor, entries } = chaseList(profile, catalog, shows, todayUTC());

  return { anchor, entries, degraded };
}
