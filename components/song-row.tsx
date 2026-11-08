'use client';

import { useId, useState } from 'react';

export interface SongOccurrence {
  showId: string;
  /** Pre-formatted display date ("MM/DD/YY"), produced by the server. */
  date: string;
  venueLabel: string;
  count: number;
}

interface SongRowProps {
  rank: number;
  song: string;
  count: number;
  /** The largest count in the list, used to scale the bar width. */
  maxCount: number;
  /** Per-show breakdown (newest first), shown when the row is expanded. */
  shows: SongOccurrence[];
}

/**
 * A ranked song line inside a stat-card (DESIGN.md §song-row): rank numeral,
 * song title, an inline bar, and a count numeral. The #1/top row's bar fills
 * red (accent-2); all others fill blue. Tapping the row expands it **in place**
 * to a per-show breakdown (`aria-expanded` drives the state) — no separate song
 * screen (EXPERIENCE.md §Interaction Primitives).
 */
export function SongRow({ rank, song, count, maxCount, shows }: SongRowProps) {
  const [open, setOpen] = useState(false);
  const breakdownId = useId();
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  const isTop = rank === 1;

  return (
    <div className={`song-row${isTop ? ' song-row--top' : ''}`}>
      <button
        type="button"
        className="song-row__toggle"
        aria-expanded={open}
        aria-controls={open ? breakdownId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="song-row__rank">{rank}</span>
        <span className="song-row__title">{song}</span>
        <span className="song-row__bar" aria-hidden="true">
          <span className="song-row__bar-fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="song-row__count">{count}</span>
      </button>

      {open ? (
        <ul className="song-row__breakdown" id={breakdownId}>
          {shows.map((show) => (
            <li key={show.showId} className="song-row__breakdown-item">
              <time className="song-row__breakdown-date">{show.date}</time>
              <span className="song-row__breakdown-venue">{show.venueLabel}</span>
              {show.count > 1 ? (
                <span className="song-row__breakdown-count">&times;{show.count}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
