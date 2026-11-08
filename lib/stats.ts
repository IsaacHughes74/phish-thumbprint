import 'server-only';

import { env } from './env';
import { getSetlist, getSongsCatalog } from './phishnet';
import type { SetlistRow, SongRecord } from './phishnet/types';
import { computeReport, type Report } from './stats-core';
import type { ShowHistoryRow } from './history-core';

/**
 * Server-only Personal Report (AD-1 / AD-2): take the Phan's Show History
 * (already fetched by the page for its empty-state check), pull every Show's
 * cached Setlist and the song catalog through the single phish.net proxy
 * (AD-3), then derive the report with the pure `computeReport` core. Importing
 * this module from a Client Component fails the build (AD-1).
 *
 * A missing/empty/rate-limited Setlist never blocks reading: the Show still
 * counts toward "shows" and contributes no song rows (FR-5). The song catalog
 * is also best-effort — a failed fetch degrades to an empty never-heard list
 * rather than a broken Report (EXPERIENCE §State Patterns: never block reading).
 * Any fetch failure sets `degraded` so the surface can show a non-blocking
 * banner instead of failing silently.
 */
export interface ReportResult {
  report: Report;
  /** True when a Setlist or song-catalog fetch failed (rate limit or otherwise) — the Report is incomplete. */
  degraded: boolean;
}

export async function getReport(history: ShowHistoryRow[]): Promise<ReportResult> {
  let degraded = false;

  const setlistEntries = await Promise.all(
    history.map(
      async (row): Promise<[string, SetlistRow[]]> => {
        try {
          return [row.phishnetShowId, await getSetlist(row.phishnetShowId)];
        } catch (error) {
          // Swallow setlist errors (FR-5): the Show stays, the rows are empty.
          degraded = true;
          console.error(`getReport: setlist fetch failed for show ${row.phishnetShowId}`, error);
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
    // Never-heard degrades to an empty state rather than a broken Report.
    degraded = true;
    console.error('getReport: song catalog fetch failed', error);
    catalog = [];
  }

  return {
    report: computeReport(history, setlistsByShow, catalog, env.BUST_OUT_GAP_THRESHOLD),
    degraded,
  };
}
