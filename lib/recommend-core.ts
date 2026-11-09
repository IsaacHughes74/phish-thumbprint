import type { SetlistRow, ShowRecord, SongRecord } from './phishnet/types';

/**
 * Pure, dependency-free core of the recommendation layer (AD-4). Split from
 * `lib/recommend.ts` (which adds `server-only` and wires the live phish.net +
 * Show History fetches) so the profile/ranking/why-writer logic is unit-testable
 * without a database or network — the same seam `stats-core.ts` /
 * `history-core.ts` use.
 *
 * AD-4 pins this module to exactly one taste-profile derivation function
 * (`deriveTasteProfile`), one ranking entry point (`rankCandidates`), and one
 * `why-writer` interface. Tailored Picks (now) and Chase List (Story 6) are
 * callers of the *same* ranker; the "already-heard" (`hasHeardLive`) and
 * "heavily-heard" (`isHeavilyHeard`) predicates are defined once and shared.
 *
 * Everything derives from Show History + cached Setlist rows + the song catalog
 * at read time; nothing here is materialized (AD-2). Canonical keys: songs key
 * on `phishnet_song_id`; "heard live" = setlist row count (ARCHITECTURE-SPINE
 * §Consistency). The one-line "why" is deterministic (templated from real
 * history) and produced only through the `WhyWriter` seam — the LLM writer is
 * deferred per AD-4.
 */

/** A Phan's derived taste signature: heard-song ids/counts + a debut-decade fingerprint. */
export interface TasteProfile {
  /** Distinct `phishnet_song_id` values the Phan has heard live. */
  heardSongIds: Set<string>;
  /** songid -> number of Setlist rows (heard-live count). */
  heardCounts: Map<string, number>;
  /** Debut decades of heard songs, e.g. '1980s', '1990s' (the era fingerprint). */
  heardDecades: Set<string>;
  /** Total Setlist rows across Show History. */
  heardLive: number;
  /** Distinct heard song count. */
  uniqueSongs: number;
}

/** A candidate song handed to the shared ranker, carrying the metadata it needs. */
export interface RankCandidate {
  songid: string;
  song: string;
  /** Raw `debut` from the catalog (date or year), or ''. */
  debut: string;
  /** Raw `last_played` (date), or ''. */
  lastPlayed: string;
  timesPlayed: number;
}

/** One surface-ready recommendation: the song plus its one-line "why". */
export interface TailoredPick {
  songid: string;
  song: string;
  why: string;
}

/**
 * The inferred Chase List anchor (AD-2: inferred at read, never persisted).
 * `show` = a known upcoming show; `tour` = no upcoming show, but a past show's
 * tour; `none` = the shows catalog was empty/unavailable.
 */
export type ChaseAnchor =
  | { kind: 'show'; showdate: string; venue: string; tourName: string }
  | { kind: 'tour'; tourName: string }
  | { kind: 'none' };

/** One surface-ready Chase List entry: a never-heard song plus its "why". */
export interface ChaseEntry {
  songid: string;
  song: string;
  why: string;
}

/**
 * The writer seam (AD-4): produces the one-line "why" for a pick. v1 ships only
 * `deterministicWhyWriter` (facts templated from real history); an LLM writer
 * slots in behind this same interface later.
 */
export interface WhyWriter {
  write(candidate: RankCandidate, profile: TasteProfile): string;
}

/** How many picks a Tailored Picks card shows (code-owned constant, tunable without touching the seam). */
export const TOP_N = 6;

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

/** Extract the leading 4-digit year from a date/year string, or null. */
function yearOf(value: string): number | null {
  const match = /^(\d{4})/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isFinite(year) && year > 0 ? year : null;
}

/** Canonical decade key for the era fingerprint: '1980s', '1990s', … */
function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/** Short two-digit year for display: "'85", "'97", "'04", … */
function shortYear(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}

/** Short decade for display: "'80s", "'90s", … */
function shortDecade(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `'${String(decade % 100).padStart(2, '0')}s`;
}

/**
 * Derive the Phan's Taste Profile from cached Setlist rows + the song catalog.
 * `setlistsByShow` maps a phish.net show id to its cached rows (possibly `[]`).
 * The era fingerprint comes from each heard song's `debut` year (4-digit year →
 * decade); songs with no catalog entry or no debut simply contribute no decade.
 */
export function deriveTasteProfile(
  setlistsByShow: Record<string, SetlistRow[]>,
  songCatalog: SongRecord[],
): TasteProfile {
  const heardCounts = new Map<string, number>();

  for (const rows of Object.values(setlistsByShow)) {
    for (const row of rows) {
      const songid = toStr(row.songid);
      if (!songid) {
        continue;
      }
      heardCounts.set(songid, (heardCounts.get(songid) ?? 0) + 1);
    }
  }

  const debutBySong = new Map<string, string>();
  for (const record of songCatalog) {
    const songid = toStr(record.songid);
    if (!songid) {
      continue;
    }
    debutBySong.set(songid, toStr(record.debut));
  }

  const heardDecades = new Set<string>();
  let heardLive = 0;
  for (const [songid, count] of heardCounts) {
    heardLive += count;
    const debut = debutBySong.get(songid);
    if (debut) {
      const year = yearOf(debut);
      if (year !== null) {
        heardDecades.add(decadeOf(year));
      }
    }
  }

  return {
    heardSongIds: new Set(heardCounts.keys()),
    heardCounts,
    heardDecades,
    heardLive,
    uniqueSongs: heardCounts.size,
  };
}

/** The shared "already-heard" predicate: has the Phan heard this song live at least once? */
export function hasHeardLive(profile: TasteProfile, songid: string): boolean {
  return profile.heardCounts.has(songid);
}

/** The shared "heavily-heard" predicate: heard live twice or more (excluded from picks). */
export function isHeavilyHeard(profile: TasteProfile, songid: string): boolean {
  return (profile.heardCounts.get(songid) ?? 0) >= 2;
}

/** Era-match score: 1 when the candidate's debut decade is in the profile's heard decades, else 0. */
function eraMatchScore(candidate: RankCandidate, profile: TasteProfile): number {
  if (profile.heardDecades.size === 0) {
    return 0;
  }
  const year = yearOf(candidate.debut);
  if (year === null) {
    return 0;
  }
  return profile.heardDecades.has(decadeOf(year)) ? 1 : 0;
}

/**
 * The single ranking entry point (AD-4). Sorts candidates by (1) era match —
 * candidate's debut decade ∈ the profile's heard decades — DESC, then (2)
 * `last_played` DESC, then (3) `times_played` DESC, then (4) `song` ASC.
 * Tailored Picks and Chase List both rank through here; never mutate the input.
 *
 * When `preferEra` is `false` (Chase List), the era-match primary is skipped and
 * candidates sort purely by play-likelihood (`last_played` DESC → `times_played`
 * DESC → `song` ASC), a deterministic proxy for "likely at the next show".
 */
export interface RankOptions {
  /** Prefer era-match as the primary sort key. Defaults to `true` (Tailored Picks). */
  preferEra?: boolean;
}

export function rankCandidates(
  candidates: RankCandidate[],
  profile: TasteProfile,
  options: RankOptions = {},
): RankCandidate[] {
  const { preferEra = true } = options;
  return [...candidates].sort((a, b) => {
    if (preferEra) {
      const eraA = eraMatchScore(a, profile);
      const eraB = eraMatchScore(b, profile);
      if (eraA !== eraB) {
        return eraB - eraA; // era-match first
      }
    }
    const last = b.lastPlayed.localeCompare(a.lastPlayed);
    if (last !== 0) {
      return last;
    }
    if (a.timesPlayed !== b.timesPlayed) {
      return b.timesPlayed - a.timesPlayed;
    }
    return a.song.localeCompare(b.song);
  });
}

/**
 * The deterministic v1 writer (AD-4). Cites the heard status plus one real fact
 * (debut year/decade, `last_played`, `times_played`). Voice is nerdy, sharp,
 * warm, concrete — no emoji, no superlatives, no exclamation marks.
 */
export const deterministicWhyWriter: WhyWriter = {
  write(candidate, profile) {
    const heardCount = profile.heardCounts.get(candidate.songid) ?? 0;
    const debutYear = yearOf(candidate.debut);
    const lastPlayedYear = yearOf(candidate.lastPlayed);

    if (heardCount === 0) {
      if (debutYear !== null) {
        const wheelhouse = profile.heardDecades.has(decadeOf(debutYear))
          ? `, right in your ${shortDecade(debutYear)} wheelhouse`
          : '';
        return `You've never caught it live \u2014 and it debuted in ${shortYear(
          debutYear,
        )}${wheelhouse}.`;
      }
      if (lastPlayedYear !== null) {
        return `You've never caught it live \u2014 last played ${lastPlayedYear}.`;
      }
      return `You've never caught it live.`;
    }

    if (lastPlayedYear !== null && candidate.timesPlayed > 0) {
      return `You've only caught it once \u2014 played ${candidate.timesPlayed} times, last heard in ${lastPlayedYear}.`;
    }
    return `You've only caught it once.`;
  },
};

/**
 * The Tailored Picks caller (CAP-4 / FR-15..17). Builds candidates from the song
 * catalog, excluding heavily-heard songs (heard count ≥ 2); never-heard (count 0)
 * and rarely-heard (count 1) are both eligible. Ranks through the shared
 * `rankCandidates`, takes the top `TOP_N`, and writes each pick's "why" through
 * the `WhyWriter` seam.
 */
export function tailoredPicks(
  profile: TasteProfile,
  songCatalog: SongRecord[],
  whyWriter: WhyWriter = deterministicWhyWriter,
): TailoredPick[] {
  // No heard songs => no taste signature to match against (FR-15): return an
  // empty list so the surface shows a quiet "no picks" state, never recency
  // picks that aren't tailored to anything.
  if (profile.uniqueSongs === 0) {
    return [];
  }

  const candidates: RankCandidate[] = [];
  for (const record of songCatalog) {
    const songid = toStr(record.songid);
    if (!songid || isHeavilyHeard(profile, songid)) {
      continue;
    }
    candidates.push({
      songid,
      song: toStr(record.song) || '(unknown song)',
      debut: toStr(record.debut),
      lastPlayed: toStr(record.last_played),
      timesPlayed: toNum(record.times_played) ?? 0,
    });
  }

  return rankCandidates(candidates, profile)
    .slice(0, TOP_N)
    .map((candidate) => ({
      songid: candidate.songid,
      song: candidate.song,
      why: whyWriter.write(candidate, profile),
    }));
}

/**
 * The deterministic Chase List writer (AD-4). Cites play-likelihood facts only —
 * all-time frequency (`times_played`) and recency (`last_played`) — never debut
 * or era (that's `deterministicWhyWriter`'s job), never generic praise. Distinct
 * from `deterministicWhyWriter` on purpose: the Chase List "why" answers "why is
 * this likely at the next show", not "why does this fit your taste".
 */
export const chaseWhyWriter: WhyWriter = {
  write(candidate) {
    const lastPlayedYear = yearOf(candidate.lastPlayed);

    if (candidate.timesPlayed > 0) {
      if (lastPlayedYear !== null) {
        return `You've never caught it live \u2014 played ${candidate.timesPlayed} times, last heard in ${lastPlayedYear}.`;
      }
      return `You've never caught it live \u2014 played ${candidate.timesPlayed} times.`;
    }

    if (lastPlayedYear !== null) {
      return `You've never caught it live \u2014 last played ${lastPlayedYear}.`;
    }
    return `You've never caught it live.`;
  },
};

/**
 * Infer the Chase List anchor from the phish.net shows catalog (AD-2: inferred at
 * read, never persisted). Pure and date-based: the earliest show with
 * `showdate >= today` is the next show; otherwise the most recent show's tour
 * (`tour_name`) is "this tour"; otherwise (empty catalog) `none`. `today` is the
 * server's UTC date, passed in so the core stays deterministic and testable.
 */
export function inferChaseAnchor(shows: ShowRecord[], today: string): ChaseAnchor {
  let upcoming: ShowRecord | null = null;
  let recent: ShowRecord | null = null;

  for (const show of shows) {
    const showdate = toStr(show.showdate);
    if (showdate === '') {
      continue;
    }
    if (showdate >= today) {
      if (upcoming === null || showdate < toStr(upcoming.showdate)) {
        upcoming = show;
      }
    }
    if (recent === null || showdate > toStr(recent.showdate)) {
      recent = show;
    }
  }

  if (upcoming !== null) {
    return {
      kind: 'show',
      showdate: toStr(upcoming.showdate),
      venue: toStr(upcoming.venue),
      tourName: toStr(upcoming.tour_name),
    };
  }

  if (recent !== null) {
    return { kind: 'tour', tourName: toStr(recent.tour_name) };
  }

  return { kind: 'none' };
}

/**
 * The Chase List caller (CAP-5 / FR-18..19). Builds candidates from the song
 * catalog, keeping only never-heard songs (`!hasHeardLive`, heard count 0 — FR-19).
 * Ranks them through the shared `rankCandidates` with `preferEra: false` (pure
 * play-likelihood), takes the top `TOP_N`, and writes each entry's "why" through
 * the injected `WhyWriter`. The anchor is inferred from `shows` + `today`.
 */
export function chaseList(
  profile: TasteProfile,
  songCatalog: SongRecord[],
  shows: ShowRecord[],
  today: string,
  whyWriter: WhyWriter = chaseWhyWriter,
): { anchor: ChaseAnchor; entries: ChaseEntry[] } {
  const anchor = inferChaseAnchor(shows, today);

  // No heard songs => no meaningful "never-heard" set to chase (mirrors
  // `tailoredPicks`'s guard): return an empty list so a degraded (empty-heard)
  // profile never yields TOP_N false "never caught it live" entries. The anchor
  // is still returned so the surface can show its note.
  if (profile.uniqueSongs === 0) {
    return { anchor, entries: [] };
  }

  const candidates: RankCandidate[] = [];
  for (const record of songCatalog) {
    const songid = toStr(record.songid);
    if (!songid || hasHeardLive(profile, songid)) {
      continue;
    }
    candidates.push({
      songid,
      song: toStr(record.song) || '(unknown song)',
      debut: toStr(record.debut),
      lastPlayed: toStr(record.last_played),
      timesPlayed: toNum(record.times_played) ?? 0,
    });
  }

  const entries: ChaseEntry[] = rankCandidates(candidates, profile, { preferEra: false })
    .slice(0, TOP_N)
    .map((candidate) => ({
      songid: candidate.songid,
      song: candidate.song,
      why: whyWriter.write(candidate, profile),
    }));

  return { anchor, entries };
}
