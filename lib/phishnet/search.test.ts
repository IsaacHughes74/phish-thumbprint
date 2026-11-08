import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesShowQuery, searchShows, toMMDDYY } from './search';
import type { ShowRecord } from './types';

const mann: ShowRecord = {
  showid: 1251937496,
  showdate: '2026-07-18',
  venueid: 100,
  venue: 'The Mann Center',
  city: 'Philadelphia',
  state: 'PA',
};

// I/O & Edge-Case Matrix coverage:
//   - "Search by venue/date" -> matches showdate (ISO + MM/DD/YY), venue, city, state
//   - case-insensitive substring
//   - no match -> excluded

test('toMMDDYY formats an ISO date as MM/DD/YY', () => {
  assert.equal(toMMDDYY('2026-07-18'), '07/18/26');
  assert.equal(toMMDDYY('1997-11-22'), '11/22/97');
});

test('toMMDDYY passes through a non-ISO value unchanged', () => {
  assert.equal(toMMDDYY('not-a-date'), 'not-a-date');
});

test('matches by venue substring, case-insensitive', () => {
  assert.equal(matchesShowQuery('mann', mann), true);
  assert.equal(matchesShowQuery('MANN CENTER', mann), true);
});

test('matches by ISO showdate', () => {
  assert.equal(matchesShowQuery('2026-07-18', mann), true);
});

test('matches by MM/DD/YY showdate', () => {
  assert.equal(matchesShowQuery('07/18/26', mann), true);
});

test('matches by city substring', () => {
  assert.equal(matchesShowQuery('philadelphia', mann), true);
});

test('matches by state', () => {
  assert.equal(matchesShowQuery('pa', mann), true);
});

test('does not match an unrelated query', () => {
  assert.equal(matchesShowQuery('spaceland', mann), false);
});

test('an empty query matches everything', () => {
  assert.equal(matchesShowQuery('', mann), true);
  assert.equal(matchesShowQuery('   ', mann), true);
});

test('searchShows filters a catalog to matching shows', () => {
  const catalog: ShowRecord[] = [
    mann,
    {
      showid: 2,
      showdate: '2026-07-17',
      venueid: 101,
      venue: 'Merriweather Post Pavilion',
      city: 'Columbia',
      state: 'MD',
    },
    {
      showid: 3,
      showdate: '1997-11-22',
      venueid: 102,
      venue: 'Worcester Centrum Centre',
      city: 'Worcester',
      state: 'MA',
    },
  ];

  assert.deepEqual(
    searchShows('mann', catalog).map((s) => s.showid),
    [1251937496],
  );
  assert.deepEqual(
    searchShows('1997-11-22', catalog).map((s) => s.showid),
    [3],
  );
  assert.equal(searchShows('spaceland', catalog).length, 0);
});
