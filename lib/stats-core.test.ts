import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReport } from './stats-core';
import type { ShowHistoryRow } from './history-core';
import type { SetlistRow, SongRecord } from './phishnet/types';

function show(
  phishnetShowId: string,
  showDate: string,
  venueId: string,
  venueLabel: string,
): ShowHistoryRow {
  return {
    id: `id-${phishnetShowId}`,
    userId: 'user-1',
    phishnetShowId,
    phishnetVenueId: venueId,
    showDate,
    venueLabel,
  };
}

function setlistRow(
  showid: string,
  songid: string,
  song: string,
  position: number,
  set: string,
  opts: { gap?: number; tourname?: string } = {},
): SetlistRow {
  return {
    showid,
    songid,
    song,
    position,
    set,
    gap: opts.gap,
    tourname: opts.tourname,
  };
}

function songRecord(
  songid: string,
  song: string,
  last_played: string,
  times_played: number,
): SongRecord {
  return { songid, song, slug: `${songid}-${song}`, last_played, times_played, gap: 0, debut: '1985-01-01' };
}

test('stat-band counts derive from Show History + setlist rows', () => {
  const history = [
    show('s1', '2025-07-18', 'v1', 'The Mann Center'),
    show('s2', '2026-08-01', 'v2', 'Madison Square Garden'),
  ];
  const setlists = {
    s1: [
      setlistRow('s1', 'a', 'Tweezer', 1, '1'),
      setlistRow('s1', 'b', 'Chalk Dust', 2, '1'),
      setlistRow('s1', 'a', 'Tweezer', 1, 'E'),
    ],
    s2: [setlistRow('s2', 'a', 'Tweezer', 1, '1')],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(report.statBand, {
    shows: 2,
    heardLive: 4,
    uniqueSongs: 2,
    venues: 2,
  });
});

test('a Show with no Setlist still counts toward shows but contributes no rows', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const report = computeReport(history, {}, [], 50);

  assert.equal(report.statBand.shows, 1);
  assert.equal(report.statBand.heardLive, 0);
  assert.equal(report.statBand.uniqueSongs, 0);
});

test('most-heard counts exactly match setlist rows, ordered descending', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const setlists = {
    s1: [
      setlistRow('s1', 'a', 'Tweezer', 1, '1'),
      setlistRow('s1', 'b', 'Chalk Dust', 2, '1'),
      setlistRow('s1', 'a', 'Tweezer', 3, '2'),
      setlistRow('s1', 'c', 'Hood', 4, '2'),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(
    report.mostHeard.map((m) => [m.song, m.count]),
    [
      ['Tweezer', 2],
      ['Chalk Dust', 1],
      ['Hood', 1],
    ],
  );
});

test('most-heard carries a per-show breakdown', () => {
  const history = [
    show('s1', '2025-07-18', 'v1', 'The Mann Center'),
    show('s2', '2026-08-01', 'v2', 'Madison Square Garden'),
  ];
  const setlists = {
    s1: [setlistRow('s1', 'a', 'Tweezer', 1, '1')],
    s2: [
      setlistRow('s2', 'a', 'Tweezer', 2, '1'),
      setlistRow('s2', 'a', 'Tweezer', 2, '2'),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.equal(report.mostHeard[0].count, 3);
  assert.deepEqual(
    report.mostHeard[0].shows.map((s) => [s.showId, s.count]),
    [
      ['s2', 2],
      ['s1', 1],
    ],
  );
});

test('bust-outs flag rows with gap >= threshold and name their Show', () => {
  const history = [
    show('s1', '2025-07-18', 'v1', 'The Mann Center'),
    show('s2', '2026-08-01', 'v2', 'Madison Square Garden'),
  ];
  const setlists = {
    s1: [setlistRow('s1', 'a', 'The Lizards', 1, '1', { gap: 200 })],
    s2: [
      setlistRow('s2', 'b', 'Destiny Unbound', 1, '1', { gap: 112 }),
      setlistRow('s2', 'c', 'Icculus', 2, '1', { gap: 49 }),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.equal(report.bustOuts.length, 2);
  assert.deepEqual(
    report.bustOuts.map((b) => [b.song, b.gap, b.showId]),
    [
      ['The Lizards', 200, 's1'],
      ['Destiny Unbound', 112, 's2'],
    ],
  );
});

test('never-heard excludes heard songs and orders by last_played then times_played', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const setlists = { s1: [setlistRow('s1', 'heard', 'Tweezer', 1, '1')] };
  const catalog = [
    songRecord('heard', 'Tweezer', '2026-01-01', 999),
    songRecord('x', 'Harpua', '2025-05-05', 400),
    songRecord('y', 'Icculus', '2025-05-05', 300),
    songRecord('z', 'Lengthwise', '', 5),
  ];
  const report = computeReport(history, setlists, catalog, 50);

  assert.deepEqual(
    report.neverHeard.map((n) => n.song),
    ['Harpua', 'Icculus', 'Lengthwise'],
  );
  // Harpua and Icculus share last_played; times_played breaks the tie (400 > 300).
  // Lengthwise has an empty last_played, so it sorts last.
});

test('never-heard is empty for an empty catalog', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const report = computeReport(history, {}, [], 50);
  assert.deepEqual(report.neverHeard, []);
});

test('trends derive openers, closers, encores, and second-set openers', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const setlists = {
    s1: [
      setlistRow('s1', 'open', 'Tweezer', 1, '1'),
      setlistRow('s1', 'mid', 'Chalk Dust', 2, '1'),
      setlistRow('s1', 'close1', 'Hood', 3, '1'),
      setlistRow('s1', 'open2', 'Carini', 1, '2'),
      setlistRow('s1', 'close2', 'YEM', 2, '2'),
      setlistRow('s1', 'enc', 'GTBT', 1, 'E'),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(
    report.trends.openers.map((t) => t.song),
    ['Tweezer'],
  );
  assert.deepEqual(
    report.trends.secondSetOpeners.map((t) => t.song),
    ['Carini'],
  );
  // Each numbered set contributes one closer (max position).
  assert.deepEqual(
    report.trends.closers.map((t) => [t.song, t.count]),
    [
      ['Hood', 1],
      ['YEM', 1],
    ],
  );
  assert.deepEqual(
    report.trends.encores.map((t) => t.song),
    ['GTBT'],
  );
});

test('trends handle continuous position (set 2 opener is the min position)', () => {
  const history = [show('s1', '2026-07-25', 'v1', 'Madison Square Garden')];
  const setlists = {
    s1: [
      setlistRow('s1', 'a', 'Back in the U.S.S.R.', 1, '1'),
      setlistRow('s1', 'b', 'Simple', 5, '1'),
      setlistRow('s1', 'c', 'Highway to Hell', 6, '2'),
      setlistRow('s1', 'd', 'The Squirming Coil', 20, '2'),
      setlistRow('s1', 'e', 'Tweezer Reprise', 22, 'e'),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(report.trends.openers.map((t) => t.song), ['Back in the U.S.S.R.']);
  assert.deepEqual(report.trends.secondSetOpeners.map((t) => t.song), ['Highway to Hell']);
  assert.deepEqual(report.trends.closers.map((t) => [t.song, t.count]), [
    ['Simple', 1],
    ['The Squirming Coil', 1],
  ]);
  assert.deepEqual(report.trends.encores.map((t) => t.song), ['Tweezer Reprise']);
});

test('shows by year keys on the show_date year', () => {
  const history = [
    show('s1', '2024-08-01', 'v1', 'A'),
    show('s2', '2025-07-18', 'v2', 'B'),
    show('s3', '2025-12-31', 'v3', 'C'),
  ];
  const report = computeReport(history, {}, [], 50);

  assert.deepEqual(report.trends.showsByYear, [
    { label: '2024', count: 1 },
    { label: '2025', count: 2 },
  ]);
});

test('shows by tour uses the setlist tourname and buckets missing setlists as Unknown', () => {
  const history = [
    show('s1', '2025-07-18', 'v1', 'A'),
    show('s2', '2025-08-01', 'v2', 'B'),
    show('s3', '2025-09-01', 'v3', 'C'),
  ];
  const setlists = {
    s1: [setlistRow('s1', 'a', 'Tweezer', 1, '1', { tourname: 'Summer Tour 2025' })],
    s2: [setlistRow('s2', 'b', 'Hood', 1, '1', { tourname: 'Summer Tour 2025' })],
    // s3 has no setlist -> Unknown
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(report.trends.showsByTour, [
    { label: 'Summer Tour 2025', count: 2 },
    { label: 'Unknown', count: 1 },
  ]);
});

test('venues group per-venue Show counts by phishnet_venue_id', () => {
  const history = [
    show('s1', '2025-07-18', 'v1', 'Madison Square Garden'),
    show('s2', '2025-08-01', 'v1', 'Madison Square Garden'),
    show('s3', '2025-09-01', 'v2', 'The Gorge'),
  ];
  const report = computeReport(history, {}, [], 50);

  assert.equal(report.statBand.venues, 2);
  assert.deepEqual(
    report.venues.map((v) => [v.venue, v.count]),
    [
      ['Madison Square Garden', 2],
      ['The Gorge', 1],
    ],
  );
});

test('empty history produces zeroed stats (never zero-filled charts)', () => {
  const report = computeReport([], {}, [], 50);

  assert.deepEqual(report.statBand, {
    shows: 0,
    heardLive: 0,
    uniqueSongs: 0,
    venues: 0,
  });
  assert.deepEqual(report.mostHeard, []);
  assert.deepEqual(report.bustOuts, []);
  assert.deepEqual(report.neverHeard, []);
  assert.deepEqual(report.venues, []);
});

test('empty trends produce empty lists, not broken charts', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  // Only an encore row: no opener, no closer, no second-set opener.
  const setlists = { s1: [setlistRow('s1', 'enc', 'GTBT', 1, 'E')] };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(report.trends.openers, []);
  assert.deepEqual(report.trends.closers, []);
  assert.deepEqual(report.trends.secondSetOpeners, []);
  assert.deepEqual(report.trends.encores.map((t) => t.song), ['GTBT']);
  assert.deepEqual(report.trends.showsByYear, [{ label: '2025', count: 1 }]);
  assert.deepEqual(report.trends.showsByTour, [{ label: 'Unknown', count: 1 }]);
});

test('bust-out flags a gap exactly at the threshold (>=)', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const setlists = {
    s1: [
      setlistRow('s1', 'a', 'The Lizards', 1, '1', { gap: 50 }),
      setlistRow('s1', 'b', 'Hood', 2, '1', { gap: 49 }),
    ],
  };
  const report = computeReport(history, setlists, [], 50);

  assert.deepEqual(
    report.bustOuts.map((b) => [b.song, b.gap]),
    [['The Lizards', 50]],
  );
});

test('non-numeric position and gap are ignored, not thrown', () => {
  const history = [show('s1', '2025-07-18', 'v1', 'The Mann Center')];
  const rows: SetlistRow[] = [
    // Unparseable position → not an opener; unparseable gap → not a bust-out.
    { showid: 's1', songid: 'a', song: 'Tweezer', position: 'x', set: '1', gap: 'garbage' },
    // Parseable position → the opener (set 1, position 1); no gap → not a bust-out.
    { showid: 's1', songid: 'b', song: 'Hood', position: 1, set: '1' },
  ];
  const report = computeReport(history, { s1: rows }, [], 50);

  assert.deepEqual(report.trends.openers.map((t) => t.song), ['Hood']);
  assert.deepEqual(report.bustOuts, []);
  assert.equal(report.statBand.heardLive, 2);
});
