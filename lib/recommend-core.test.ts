import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chaseList,
  chaseWhyWriter,
  deriveTasteProfile,
  deterministicWhyWriter,
  hasHeardLive,
  inferChaseAnchor,
  isHeavilyHeard,
  rankCandidates,
  tailoredPicks,
  TOP_N,
  type RankCandidate,
  type TasteProfile,
} from './recommend-core';
import type { SetlistRow, ShowRecord, SongRecord } from './phishnet/types';

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

function showRecord(
  showdate: string,
  venue: string,
  tour_name?: string,
): ShowRecord {
  return {
    showid: `show-${showdate}`,
    showdate,
    venueid: 'venue-1',
    venue,
    city: 'Philadelphia',
    state: 'PA',
    tour_name,
  };
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

test('rankCandidates with preferEra:false skips era-match and sorts by play-likelihood', () => {
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
    { songid: 'm2', song: 'MatchB', debut: '1997-01-01', lastPlayed: '2025-01-01', timesPlayed: 50 },
  ];

  // preferEra:false ignores the era fingerprint entirely — last_played DESC then
  // times_played DESC then name. n90 (2026) first; m1/m2 tie on last_played, so
  // times_played breaks it (100 vs 50).
  assert.deepEqual(
    rankCandidates(candidates, profile, { preferEra: false }).map((c) => c.songid),
    ['n90', 'm1', 'm2'],
  );

  // Default (preferEra:true) puts era matches first: m1 and m2 both match, tie on
  // last_played, so times_played breaks it (100 vs 50) — then the non-match n90.
  assert.deepEqual(
    rankCandidates(candidates, profile).map((c) => c.songid),
    ['m1', 'm2', 'n90'],
  );
});

test('rankCandidates with preferEra:false does not mutate the input', () => {
  const profile = profileWith({});
  const candidates: RankCandidate[] = [
    { songid: 'a', song: 'A', debut: '1990-01-01', lastPlayed: '2025-01-01', timesPlayed: 10 },
    { songid: 'b', song: 'B', debut: '1990-01-01', lastPlayed: '2026-01-01', timesPlayed: 1 },
  ];
  const snapshot = JSON.parse(JSON.stringify(candidates));

  rankCandidates(candidates, profile, { preferEra: false });

  assert.deepEqual(candidates, snapshot);
});

test('inferChaseAnchor picks the earliest upcoming show when one exists', () => {
  const shows = [
    showRecord('2026-04-12', 'MSG', 'Spring Tour 2026'),
    showRecord('2026-04-11', 'The Mann Center', 'Spring Tour 2026'),
    showRecord('2025-12-31', 'MSG', 'New Year\u2019s Run 2025'),
  ];

  const anchor = inferChaseAnchor(shows, '2026-01-01');
  assert.deepEqual(anchor, {
    kind: 'show',
    showdate: '2026-04-11',
    venue: 'The Mann Center',
    tourName: 'Spring Tour 2026',
  });
});

test('inferChaseAnchor falls back to the most recent tour when only past shows exist', () => {
  const shows = [
    showRecord('2025-12-31', 'MSG', 'New Year\u2019s Run 2025'),
    showRecord('2025-07-04', 'The Gorge', 'Summer Tour 2025'),
  ];

  const anchor = inferChaseAnchor(shows, '2026-01-01');
  assert.deepEqual(anchor, { kind: 'tour', tourName: 'New Year\u2019s Run 2025' });
});

test('inferChaseAnchor returns none for an empty catalog', () => {
  assert.deepEqual(inferChaseAnchor([], '2026-01-01'), { kind: 'none' });
});

test('chaseList excludes heard songs and ranks never-heard by play-likelihood', () => {
  const setlists = {
    s1: [setlistRow('s1', 'heard', 'Tweezer', 1, '1')],
  };
  const catalog = [
    songRecord('heard', 'Tweezer', '2026-01-01', 999, '1990-01-01'),
    songRecord('n1', 'Harpua', '2025-06-01', 150, '1995-01-01'),
    songRecord('n2', 'Icculus', '2024-01-01', 50, '1990-01-01'),
  ];
  const shows = [showRecord('2026-04-11', 'The Mann Center', 'Spring Tour 2026')];
  const profile = deriveTasteProfile(setlists, catalog);

  const { anchor, entries } = chaseList(profile, catalog, shows, '2026-01-01');

  assert.deepEqual(anchor, {
    kind: 'show',
    showdate: '2026-04-11',
    venue: 'The Mann Center',
    tourName: 'Spring Tour 2026',
  });
  // 'heard' is excluded (heard live); never-heard sort by last_played DESC.
  assert.deepEqual(
    entries.map((e) => e.song),
    ['Harpua', 'Icculus'],
  );
  assert.ok(entries.every((e) => typeof e.why === 'string' && e.why.length > 0));
});

test('chaseList is capped at TOP_N', () => {
  const catalog = Array.from({ length: TOP_N + 4 }, (_, i) =>
    songRecord(`s${i}`, `Song ${i}`, '2026-01-01', 100 - i, '1990-01-01'),
  );
  const { entries } = chaseList(profileWith({ heard: 1 }), catalog, [], '2026-01-01');
  assert.equal(entries.length, TOP_N);
});

test('chaseList returns no entries when every catalog song is heard', () => {
  const setlists = {
    s1: [setlistRow('s1', 'a', 'Tweezer', 1, '1')],
  };
  const catalog = [songRecord('a', 'Tweezer', '2026-01-01', 999, '1990-01-01')];
  const profile = deriveTasteProfile(setlists, catalog);

  const { entries } = chaseList(profile, catalog, [showRecord('2026-04-11', 'MSG')], '2026-01-01');
  assert.deepEqual(entries, []);
});

test('chaseList returns no entries (but keeps the anchor) for an empty profile', () => {
  const catalog = [
    songRecord('n1', 'Harpua', '2026-01-01', 150, '1995-01-01'),
    songRecord('n2', 'Icculus', '2025-06-01', 50, '1990-01-01'),
  ];
  const shows = [showRecord('2026-04-11', 'The Mann Center', 'Spring Tour 2026')];

  const { anchor, entries } = chaseList(profileWith({}), catalog, shows, '2026-01-01');

  assert.deepEqual(entries, []);
  assert.deepEqual(anchor, {
    kind: 'show',
    showdate: '2026-04-11',
    venue: 'The Mann Center',
    tourName: 'Spring Tour 2026',
  });
});

test('chaseList uses the injected why writer', () => {
  const catalog = [songRecord('n', 'Harpua', '2024-01-01', 156, '1995-01-01')];
  const writer = { write: () => 'custom why' };

  const { entries } = chaseList(
    profileWith({ heard: 1 }),
    catalog,
    [showRecord('2026-04-11', 'MSG', 'Spring Tour 2026')],
    '2026-01-01',
    writer,
  );

  assert.deepEqual(entries, [{ songid: 'n', song: 'Harpua', why: 'custom why' }]);
});

test('chaseWhyWriter cites play-likelihood facts, never debut or praise', () => {
  const profile = profileWith({}, ['1990s']);

  assert.equal(
    chaseWhyWriter.write(
      { songid: 'n', song: 'Harpua', debut: '1997-01-01', lastPlayed: '2024-06-01', timesPlayed: 156 },
      profile,
    ),
    "You've never caught it live \u2014 played 156 times, last heard in 2024.",
  );

  assert.equal(
    chaseWhyWriter.write(
      { songid: 'n', song: 'Icculus', debut: '', lastPlayed: '', timesPlayed: 5 },
      profile,
    ),
    "You've never caught it live \u2014 played 5 times.",
  );

  assert.equal(
    chaseWhyWriter.write(
      { songid: 'n', song: 'Lengthwise', debut: '', lastPlayed: '2019-06-01', timesPlayed: 0 },
      profile,
    ),
    "You've never caught it live \u2014 last played 2019.",
  );

  assert.equal(
    chaseWhyWriter.write(
      { songid: 'n', song: 'Harpua', debut: '', lastPlayed: '', timesPlayed: 0 },
      profile,
    ),
    "You've never caught it live.",
  );
});
