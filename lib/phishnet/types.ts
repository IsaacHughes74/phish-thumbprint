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
  /** Tour name, sourced for the "shows by tour" trend (FR-12). */
  tourname?: string;
  [key: string]: unknown;
}

/** A `songs` row from the artist catalog (`/songs/artist/phish.json`). */
export interface SongRecord {
  songid: number | string;
  song: string;
  slug?: string;
  times_played: number | string;
  last_played: string;
  gap?: number | string;
  debut?: string;
  [key: string]: unknown;
}
