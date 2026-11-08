/**
 * phish.net v5 response row shapes used by the proxy and its callers. Fields
 * are the phish.net column names; `showid`/`venueid`/`songid` arrive as
 * numbers and are coerced to strings only at the persistence boundary
 * (`lib/history`), where `SHOW_HISTORY` stores them as `text`.
 */

/** A `shows` row (columns per docs.phish.net §shows). */
export interface ShowRecord {
  showid: number | string;
  showdate: string;
  venueid: number | string;
  venue: string;
  city: string;
  state: string;
  country?: string;
  [key: string]: unknown;
}

/** A `setlists` row — one song performance, in `position` order (FR-4/FR-5). */
export interface SetlistRow {
  showid: number | string;
  songid: number | string;
  position: number | string;
  set: string;
  song: string;
  transition?: string;
  footnote?: string;
  gap?: number | string;
  [key: string]: unknown;
}
