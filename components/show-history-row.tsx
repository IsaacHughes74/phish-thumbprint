'use client';

import { useState } from 'react';
import { removeShow, type RemoveShowResult } from '../app/actions';

interface ShowHistoryRowProps {
  /** phish.net show id (the `(user_id, phishnet_show_id)` unique key). */
  showId: string;
  /** Display date, pre-formatted `MM/DD/YY` by the server. */
  date: string;
  /** Venue name (venue_label). */
  venue: string;
}

/**
 * One Show-history row (DESIGN.md §show-history-row): date + venue + a remove
 * control. Removing runs the `removeShow` Server Action and confirms "Removed
 * from your history." (FR-6); the page revalidates so all modules recompute.
 */
export function ShowHistoryRow({ showId, date, venue }: ShowHistoryRowProps) {
  const [removed, setRemoved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (pending || removed) return;
    setPending(true);
    setError(null);

    let result: RemoveShowResult;
    try {
      result = await removeShow(showId);
    } finally {
      setPending(false);
    }

    if (result.status === 'removed') {
      setRemoved(true);
    } else {
      setError(result.message);
    }
  }

  if (removed) {
    return (
      <li className="history-row history-row--removed">
        <span className="history-row__confirm" role="status">
          Removed from your history.
        </span>
      </li>
    );
  }

  return (
    <li className="history-row">
      <time className="history-row__date">{date}</time>
      <span className="history-row__venue">{venue}</span>
      <button
        type="button"
        className="history-row__remove"
        disabled={pending}
        onClick={handleRemove}
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error ? (
        <span className="history-row__error" role="alert">
          {error}
        </span>
      ) : null}
    </li>
  );
}
