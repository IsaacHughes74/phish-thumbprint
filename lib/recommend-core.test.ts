import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTasteProfile,
  deterministicWhyWriter,
  hasHeardLive,
  isHeavilyHeard,
  rankCandidates,
  tailoredPicks,
  TOP_N,
  type RankCandidate,
  type TasteProfile,
} from './recommend-core';
import type { SetlistRow, SongRecord } from './phishnet/types';

function setlistRow(
  showid: string,
  songid: string,
  song: string,
  position: number,
  set: string,
): SetlistRow {
  return { showid, songid, song, position, set };
}

function songRecord(
  songid: string,
  song: string,
  last_played: string,
  times_played: number,
  debut = '1985-01-01',
): SongRecord {
  return { songid, song, last_played, times_played, debut };
}

function profileWith(
  counts: Record<string, number>,
  decades: string[] = [],
): TasteProfile {
  return {
    heardSongIds: new Set(Object.keys(counts)),
    heardCounts: new Map(Object.entries(counts)),
    heardDecades: new Set(decades),
    heardLive: Object.values(counts).reduce((sum, n) => sum + n, 0),
    uniqueSongs: Object.keys(counts).length,
  };
}

test('deriveTasteProfile builds heard ids, counts, and a debut-decade fingerprint', () => {
  const setlists = {
    s1: [
      setlistRow('s1', 'a', 'Tweezer', 1, '1'),
      setlistRow('s1', 'a', 'Tweezer', 2, '2'),
      setlistRow('s1', 'b', 'Hood', 3, '2'),
    ],
  };
  const catalog = [
    songRecord('a', 'Tweezer', '2026-01-01', 999, '1990-01-01'),
    songRecord('b', 'Hood', '2026-01-01', 500, '1985-01-01'),
  ];
  const profile = deriveTasteProfile(setlists, catalog);

  assert.deepEqual([...profile.heardSongIds].sort(), ['a', 'b']);
  assert.equal(profile.heardCounts.get('a'), 2);
  assert.equal(profile.heardCounts.get('b'), 1);
  assert.equal(profile.heardLive, 3);
  assert.equal(profile.uniqueSongs, 2);
  assert.deepEqual([...profile.heardDecades].sort(), ['1980s', '1990s']);
});

test('deriveTasteProfile tolerates rows and catalog entries with no song id', () => {
  const setlists = {
    s1: [
      setlistRow('s1', '', 'No id', 1, '1'),
      setlistRow('s1', 'a', 'Tweezer', 2, '1'),
    ],
  };
  const catalog = [songRecord('', 'No id', '', 0)];
  const profile = deriveTasteProfile(setlists, catalog);

  assert.deepEqual([...profile.heardSongIds], ['a']);
  assert.equal(profile.heardLive, 1);
  assert.deepEqual([...profile.heardDecades], []);
});

test('isHeavilyHeard returns true for songs heard >= 2; hasHeardLive marks heard', () => {
  const profile = profileWith({ a: 2, b: 1 });

  assert.equal(isHeavilyHeard(profile, 'a'), true);
  assert.equal(isHeavilyHeard(profile, 'b'), false);
  assert.equal(isHeavilyHeard(profile, 'c'), false);
  assert.equal(hasHeardLive(profile, 'a'), true);
  assert.equal(hasHeardLive(profile, 'b'), true);
  assert.equal(hasHeardLive(profile, 'c'), false);
});

test('tailoredPicks excludes heavily-heard and keeps never- and rarely-heard eligible', () => {
  const setlists = {
    s1: [
      setlistRow('s1', 'heavy', 'Tweezer', 1, '1'),
      setlistRow('s1', 'heavy', 'Tweezer', 2, '2'),
      setlistRow('s1', 'rare', 'Hood', 3, '2'),
    ],
  };
  const catalog = [
    songRecord('heavy', 'Tweezer', '2026-01-01', 999, '1990-01-01'),
    songRecord('rare', 'Hood', '2026-01-01', 500, '1985-01-01'),
    songRecord('never', 'Harpua', '2026-01-01', 300, '1995-01-01'),
  ];
  const profile = deriveTasteProfile(setlists, catalog);
  const picks = tailoredPicks(profile, catalog);
  const songs = picks.map((p) => p.song);

  assert.ok(!songs.includes('Tweezer'), 'heavily-heard song must be excluded');
  assert.ok(songs.includes('Hood'), 'rarely-heard song must be eligible');
  assert.ok(songs.includes('Harpua'), 'never-heard song must be eligible');
  assert.ok(picks.every((p) => typeof p.why === 'string' && p.why.length > 0));
});

test('tailoredPicks is capped at TOP_N', () => {
  const catalog = Array.from({ length: TOP_N + 4 }, (_, i) =>
    songRecord(`s${i}`, `Song ${i}`, '2026-01-01', 100 - i, '1990-01-01'),
  );
  const picks = tailoredPicks(profileWith({ heard: 1 }), catalog);
  assert.equal(picks.length, TOP_N);
});

test('tailoredPicks returns no picks for an empty catalog', () => {
  assert.deepEqual(tailoredPicks(profileWith({ heard: 1 }), []), []);
});

test('tailoredPicks returns no picks when there are no heard songs (no taste signature)', () => {
  const catalog = [
    songRecord('a', 'Tweezer', '2026-01-01', 999, '1990-01-01'),
    songRecord('b', 'Hood', '2026-01-01', 500, '1985-01-01'),
  ];
  assert.deepEqual(tailoredPicks(profileWith({}), catalog), []);
});

test('rankCandidates orders era-match first, then last_played, times_played, name', () => {
  const profile: TasteProfile = {
    heardSongIds: new Set(['a']),
    heardCounts: new Map([['a', 1]]),
    heardDecades: new Set(['1990s']),
    heardLive: 1,
    uniqueSongs: 1,
  };
  const candidates: RankCandidate[] = [
    { songid: 'n90', song: 'NonMatch', debut: '1985-01-01', lastPlayed: '2026-01-01', timesPlayed: 999 },
    { songid: 'm1', song: 'MatchA', debut: '1995-01-01', lastPlayed: '2025-01-01', timesPlayed: 100 },
    { songid: 'm2', song: 'MatchB', debut: '1997-01-01', lastPlayed: '2026-01-01', timesPlayed: 50 },
  ];

  // Both era-matches sort first; m2 (last_played 2026) beats m1 (2025).
  // NonMatch (1980s, not in profile) sorts last despite a higher times_played.
  assert.deepEqual(
    rankCandidates(candidates, profile).map((c) => c.songid),
    ['m2', 'm1', 'n90'],
  );
});

test('rankCandidates falls through to last_played/times_played when no era fingerprint', () => {
  const profile = profileWith({});
  const candidates: RankCandidate[] = [
    { songid: 'a', song: 'A', debut: '1990-01-01', lastPlayed: '2025-01-01', timesPlayed: 10 },
    { songid: 'b', song: 'B', debut: '1990-01-01', lastPlayed: '2026-01-01', timesPlayed: 1 },
  ];

  // No heard decades, so era-match is a no-op: last_played decides (B first).
  assert.deepEqual(
    rankCandidates(candidates, profile).map((c) => c.songid),
    ['b', 'a'],
  );
});

test('deterministic why cites heard status and one real fact', () => {
  const profile = profileWith({ rare: 1 }, ['1990s']);

  const neverWithDebut: RankCandidate = {
    songid: 'n',
    song: 'Harpua',
    debut: '1997-03-01',
    lastPlayed: '2024-01-01',
    timesPlayed: 90,
  };
  assert.equal(
    deterministicWhyWriter.write(neverWithDebut, profile),
    "You've never caught it live \u2014 and it debuted in '97, right in your '90s wheelhouse.",
  );

  const neverNoDebut: RankCandidate = {
    songid: 'n2',
    song: 'Icculus',
    debut: '',
    lastPlayed: '2024-06-01',
    timesPlayed: 5,
  };
  assert.equal(
    deterministicWhyWriter.write(neverNoDebut, profile),
    "You've never caught it live \u2014 last played 2024.",
  );

  const rare: RankCandidate = {
    songid: 'rare',
    song: 'Hood',
    debut: '1985-01-01',
    lastPlayed: '2019-06-01',
    timesPlayed: 118,
  };
  assert.equal(
    deterministicWhyWriter.write(rare, profile),
    "You've only caught it once \u2014 played 118 times, last heard in 2019.",
  );
});

test('deterministic why omits the wheelhouse clause when the debut decade is not era-matched', () => {
  const profile = profileWith({ rare: 1 }, ['1980s']);
  const candidate: RankCandidate = {
    songid: 'n',
    song: 'Harpua',
    debut: '1997-03-01',
    lastPlayed: '2024-01-01',
    timesPlayed: 90,
  };

  assert.equal(
    deterministicWhyWriter.write(candidate, profile),
    "You've never caught it live \u2014 and it debuted in '97.",
  );
});

test('deterministic why falls back cleanly with no facts', () => {
  const profile = profileWith({ rare: 1 });

  assert.equal(
    deterministicWhyWriter.write(
      { songid: 'n', song: 'Harpua', debut: '', lastPlayed: '', timesPlayed: 0 },
      profile,
    ),
    "You've never caught it live.",
  );

  assert.equal(
    deterministicWhyWriter.write(
      { songid: 'rare', song: 'Hood', debut: '', lastPlayed: '', timesPlayed: 0 },
      profile,
    ),
    "You've only caught it once.",
  );
});
