import type { ShowHistoryRow } from './history-core';
import type { SetlistRow, SongRecord } from './phishnet/types';

/**
 * Pure, dependency-free core of the Personal Report derivation (AD-2). Split
 * from `lib/stats.ts` (which adds `server-only` and wires the live phish.net +
 * Show History fetches) so the derivation logic is unit-testable without a
 * database or network — the same seam `history-core.ts` / `resolve-user.ts` /
 * `env-core.ts` use.
 *
 * Every stat derives from Show History + cached Setlist rows + the song catalog
 * at read time; nothing here is materialized (AD-2). Canonical keys: songs key
 * on `phishnet_song_id` (distinct song = distinct id), venues on
 * `phishnet_venue_id`, "heard live" = setlist row count, "unique songs" =
 * distinct song ids (ARCHITECTURE-SPINE §Consistency).
 *
 * Set/position encoding (verified against phish.net v5): opener = position 1 of
 * set "1"; second-set opener = position 1 of set "2"; closer = max position of
 * a numbered set; encore = any row in set "E" (or "E2", …). "shows by year" keys
 * on the 4-digit year of `show_date`; "shows by tour" keys on a Setlist row's
 * `tourname`, bucketing a Show with no Setlist (or no tour name) as "Unknown".
 */

export interface ShowOccurrence {
  showId: string;
  showDate: string;
  venueLabel: string;
  count: number;
}

export interface MostHeardSong {
  songid: string;
  song: string;
  /** Number of Setlist rows for this song across Show History. */
  count: number;
  /** Per-show breakdown, newest show first. */
  shows: ShowOccurrence[];
}

export interface BustOut {
  songid: string;
  song: string;
  gap: number;
  showId: string;
  showDate: string;
  venueLabel: string;
}

export interface NeverHeardSong {
  songid: string;
  song: string;
  timesPlayed: number;
  lastPlayed: string;
}

export interface TrendSong {
  songid: string;
  song: string;
  count: number;
}

export interface TrendBucket {
  label: string;
  count: number;
}

export interface VenueStat {
  venueId: string;
  venue: string;
  count: number;
}

export interface Report {
  statBand: {
    shows: number;
    /** Total Setlist rows ("heard live" = row count, not distinct songs). */
    heardLive: number;
    /** Distinct `phishnet_song_id` values. */
    uniqueSongs: number;
    /** Distinct `phishnet_venue_id` values across Show History. */
    venues: number;
  };
  mostHeard: MostHeardSong[];
  bustOuts: BustOut[];
  neverHeard: NeverHeardSong[];
  trends: {
    openers: TrendSong[];
    closers: TrendSong[];
    encores: TrendSong[];
    secondSetOpeners: TrendSong[];
    showsByYear: TrendBucket[];
    showsByTour: TrendBucket[];
  };
  venues: VenueStat[];
}

const UNKNOWN_TOUR = 'Unknown';

/** Coerce a phish.net numeric-ish field (`number | string`) to a number, or null. */
function toNum(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a phish.net field to a string (canonical id/text key). */
function toStr(value: number | string | undefined): string {
  return value === undefined || value === null ? '' : String(value);
}

function isEncoreSet(set: string): boolean {
  return set.toUpperCase().startsWith('E');
}

function isNumberedSet(set: string): boolean {
  return /^[0-9]+$/.test(set);
}

function bump(
  map: Map<string, { song: string; count: number }>,
  songid: string,
  song: string,
): void {
  const existing = map.get(songid);
  if (existing) {
    existing.count += 1;
  } else {
    map.set(songid, { song, count: 1 });
  }
}

function toTrendSongs(map: Map<string, { song: string; count: number }>): TrendSong[] {
  return [...map.entries()]
    .map(([songid, value]) => ({ songid, song: value.song, count: value.count }))
    .sort((a, b) => b.count - a.count || a.song.localeCompare(b.song));
}

/** The closer of each numbered set: the row with the max numeric position. */
function setClosers(rows: SetlistRow[]): SetlistRow[] {
  const bySet = new Map<string, SetlistRow[]>();
  for (const row of rows) {
    const set = toStr(row.set);
    if (!set || !isNumberedSet(set)) {
      continue;
    }
    const list = bySet.get(set);
    if (list) {
      list.push(row);
    } else {
      bySet.set(set, [row]);
    }
  }

  const closers: SetlistRow[] = [];
  for (const list of bySet.values()) {
    let best: SetlistRow | null = null;
    let bestPos = -1;
    for (const row of list) {
      const pos = toNum(row.position);
      if (pos === null || pos <= bestPos) {
        continue;
      }
      bestPos = pos;
      best = row;
    }
    if (best) {
      closers.push(best);
    }
  }
  return closers;
}

/**
 * Derive the full Report from Show History + Setlist rows + the song catalog.
 * `setlistsByShow` maps a phish.net show id to its cached rows (possibly `[]`).
 * A Show with no/empty Setlist still counts toward "shows" but contributes no
 * song rows (FR-5). `threshold` is the bust-out gap (>= threshold flags a bust-out).
 */
export function computeReport(
  history: ShowHistoryRow[],
  setlistsByShow: Record<string, SetlistRow[]>,
  songCatalog: SongRecord[],
  threshold: number,
): Report {
  const showById = new Map<string, ShowHistoryRow>();
  for (const row of history) {
    showById.set(row.phishnetShowId, row);
  }

  // songid -> aggregate + per-show counts.
  const heard = new Map<
    string,
    { song: string; count: number; shows: Map<string, number> }
  >();
  const bustOuts: BustOut[] = [];
  const seenBustOuts = new Set<string>();
  const openers = new Map<string, { song: string; count: number }>();
  const secondSetOpeners = new Map<string, { song: string; count: number }>();
  const closers = new Map<string, { song: string; count: number }>();
  const encores = new Map<string, { song: string; count: number }>();
  const tourByShow = new Map<string, string>();

  let heardLive = 0;

  for (const show of history) {
    const rows = setlistsByShow[show.phishnetShowId] ?? [];
    let tourname = '';

    for (const row of rows) {
      const songid = toStr(row.songid);
      if (!songid) {
        continue;
      }
      const song = toStr(row.song) || '(unknown song)';

      const entry = heard.get(songid) ?? { song, count: 0, shows: new Map<string, number>() };
      entry.count += 1;
      heardLive += 1;
      entry.shows.set(show.phishnetShowId, (entry.shows.get(show.phishnetShowId) ?? 0) + 1);
      if (!heard.has(songid)) {
        heard.set(songid, entry);
      }

      const gap = toNum(row.gap);
      if (gap !== null && gap >= threshold) {
        // One bust-out per (song, show): a song played twice in one show is a
        // single return, not two rows with colliding React keys.
        const bustKey = `${show.phishnetShowId}:${songid}`;
        if (!seenBustOuts.has(bustKey)) {
          seenBustOuts.add(bustKey);
          bustOuts.push({
            songid,
            song,
            gap,
            showId: show.phishnetShowId,
            showDate: show.showDate,
            venueLabel: show.venueLabel,
          });
        }
      }

      const position = toNum(row.position);
      const set = toStr(row.set);

      if (tourname === '') {
        tourname = toStr(row.tourname);
      }

      if (set === '1' && position === 1) {
        bump(openers, songid, song);
      }
      if (set === '2' && position === 1) {
        bump(secondSetOpeners, songid, song);
      }
      if (isEncoreSet(set)) {
        bump(encores, songid, song);
      }
    }

    for (const closer of setClosers(rows)) {
      const songid = toStr(closer.songid);
      if (songid) {
        bump(closers, songid, toStr(closer.song) || '(unknown song)');
      }
    }

    if (tourname !== '') {
      tourByShow.set(show.phishnetShowId, tourname);
    }
  }

  // ---- most-heard (desc count, then name) with per-show breakdown ----
  const mostHeard: MostHeardSong[] = [...heard.entries()]
    .map(([songid, entry]) => ({
      songid,
      song: entry.song,
      count: entry.count,
      shows: [...entry.shows.entries()]
        .map(([showId, count]) => {
          const show = showById.get(showId);
          return {
            showId,
            showDate: show?.showDate ?? '',
            venueLabel: show?.venueLabel ?? '',
            count,
          };
        })
        .sort(
          (a, b) => b.showDate.localeCompare(a.showDate) || b.showId.localeCompare(a.showId),
        ),
    }))
    .sort((a, b) => b.count - a.count || a.song.localeCompare(b.song));

  // ---- bust-outs (desc gap, then newest show, then name) ----
  bustOuts.sort(
    (a, b) =>
      b.gap - a.gap ||
      b.showDate.localeCompare(a.showDate) ||
      a.song.localeCompare(b.song),
  );

  // ---- never-heard (catalog minus heard; last_played DESC then times_played DESC) ----
  const heardIds = new Set(heard.keys());
  const neverHeard: NeverHeardSong[] = songCatalog
    .filter((record) => {
      const id = toStr(record.songid);
      return id !== '' && !heardIds.has(id);
    })
    .map((record) => ({
      songid: toStr(record.songid),
      song: toStr(record.song) || '(unknown song)',
      timesPlayed: toNum(record.times_played) ?? 0,
      lastPlayed: toStr(record.last_played),
    }))
    .sort(
      (a, b) =>
        b.lastPlayed.localeCompare(a.lastPlayed) ||
        b.timesPlayed - a.timesPlayed ||
        a.song.localeCompare(b.song),
    );

  // ---- venues (per-venue Show counts, keyed on phishnet_venue_id) ----
  const venueMap = new Map<string, { venue: string; count: number }>();
  for (const row of history) {
    const venueId = toStr(row.phishnetVenueId);
    if (!venueId) {
      continue;
    }
    const existing = venueMap.get(venueId);
    if (existing) {
      if (!existing.venue && row.venueLabel) {
        existing.venue = row.venueLabel;
      }
      existing.count += 1;
    } else {
      venueMap.set(venueId, { venue: row.venueLabel || venueId, count: 1 });
    }
  }
  const venues: VenueStat[] = [...venueMap.entries()]
    .map(([venueId, value]) => ({ venueId, venue: value.venue, count: value.count }))
    .sort((a, b) => b.count - a.count || a.venue.localeCompare(b.venue));

  // ---- shows by year (chronological ascending) ----
  const yearMap = new Map<string, number>();
  for (const row of history) {
    const year = toStr(row.showDate).slice(0, 4);
    if (year === '') {
      continue;
    }
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
  }
  const showsByYear: TrendBucket[] = [...yearMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ---- shows by tour (desc count, then name); no-Setlist shows are "Unknown" ----
  const tourMap = new Map<string, number>();
  for (const row of history) {
    const tour = (tourByShow.get(row.phishnetShowId) ?? '').trim() || UNKNOWN_TOUR;
    tourMap.set(tour, (tourMap.get(tour) ?? 0) + 1);
  }
  const showsByTour: TrendBucket[] = [...tourMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    statBand: {
      shows: history.length,
      heardLive,
      uniqueSongs: heard.size,
      venues: venueMap.size,
    },
    mostHeard,
    bustOuts,
    neverHeard,
    trends: {
      openers: toTrendSongs(openers),
      closers: toTrendSongs(closers),
      encores: toTrendSongs(encores),
      secondSetOpeners: toTrendSongs(secondSetOpeners),
      showsByYear,
      showsByTour,
    },
    venues,
  };
}
