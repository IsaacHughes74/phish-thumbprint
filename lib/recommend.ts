import 'server-only';

import type { ShowHistoryRow } from './history-core';
import { getSetlist, getSongsCatalog } from './phishnet';
import type { SetlistRow, SongRecord } from './phishnet/types';
import { deriveTasteProfile, tailoredPicks, type TailoredPick } from './recommend-core';

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
