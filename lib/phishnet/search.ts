import type { ShowRecord } from './types';

/**
 * Render an ISO-8601 `showdate` ("YYYY-MM-DD") as the compact `MM/DD/YY` form
 * used in the picker results and history list (matching mockups). Falls back
 * to the input when it isn't an ISO date.
 */
export function toMMDDYY(showdate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(showdate);
  if (!match) {
    return showdate;
  }
  const [, year, month, day] = match;
  return `${month}/${day}/${year.slice(-2)}`;
}

/**
 * Pure, case-insensitive substring match of a query against a Show. Matches
 * over the `showdate` in both ISO (`YYYY-MM-DD`) and `MM/DD/YY` form, plus
 * `venue`, `city`, and `state` (AD-3: search-as-you-type is served from the
 * cached catalog, not a per-keystroke phish.net call).
 */
export function matchesShowQuery(query: string, show: ShowRecord): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }

  const haystack = [
    show.showdate,
    toMMDDYY(show.showdate),
    show.venue,
    show.city,
    show.state,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  return haystack.includes(q);
}

/** Filter a catalog of Shows to those matching a query (see `matchesShowQuery`). */
export function searchShows(query: string, shows: ShowRecord[]): ShowRecord[] {
  return shows.filter((show) => matchesShowQuery(query, show));
}
