'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { addShow, searchShows, type AddShowResult } from '../app/actions';
import type { ShowRecord } from '../lib/phishnet/types';
import { toMMDDYY } from '../lib/phishnet/search';

interface AddShowPickerProps {
  /** Trigger button label (e.g. "Add your first show", "+ add", "Add a show"). */
  triggerLabel: string;
  /** Trigger button class (defaults to the primary button style). */
  triggerClassName?: string;
  /** phish.net show ids already in the Phan's history, to mark "Already in your history." */
  recordedShowIds?: string[];
}

type SearchStatus = 'idle' | 'loading' | 'done';

const DEBOUNCE_MS = 300;

function optionId(show: ShowRecord): string {
  return `picker-option-${String(show.showid)}`;
}

/**
 * phish.net date/venue picker (EXPERIENCE.md §add-show-picker). A trigger opens
 * a scrim + panel; a debounced search-as-you-type hits the `searchShows` Server
 * Action against the cached catalog; selecting a Show runs `addShow` (which
 * pulls the Setlist best-effort) and marks it recorded. Esc / scrim close.
 */
export function AddShowPicker({
  triggerLabel,
  triggerClassName = 'btn-primary',
  recordedShowIds = [],
}: AddShowPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowRecord[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Set<string>>(
    () => new Set(recordedShowIds),
  );
  const [activeIndex, setActiveIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  const listId = useId();

  // Focus the search field when the picker opens; restore focus on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  // Escape closes and returns focus to the trigger (scrim pointer handled below).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Debounced search-as-you-type against the cached catalog. The effect body
  // only schedules the debounce (all state updates happen in the async callback
  // or in the input's onChange handler).
  useEffect(() => {
    const q = query.trim();
    if (!open || !q) return;

    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const shows = await searchShows(q);
        if (seq !== requestSeq.current) return; // stale response
        setResults(shows);
        setActiveIndex(-1);
        setStatus('done');
      } catch {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setError("Couldn't search the archive — try again.");
        setStatus('done');
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, open]);

  function handleQueryChange(value: string) {
    requestSeq.current += 1;
    setQuery(value);
    setActiveIndex(-1);
    setError(null);
    if (!value.trim()) {
      setResults([]);
      setStatus('idle');
    } else {
      setStatus('loading');
    }
  }

  function openPicker() {
    requestSeq.current += 1;
    setQuery('');
    setResults([]);
    setStatus('idle');
    setError(null);
    setActiveIndex(-1);
    setOpen(true);
  }

  function closePicker() {
    requestSeq.current += 1;
    setOpen(false);
  }

  async function handleAdd(show: ShowRecord) {
    if (recorded.has(String(show.showid)) || addingId) return;
    setAddingId(String(show.showid));
    setError(null);

    let result: AddShowResult;
    try {
      result = await addShow({
        showId: String(show.showid),
        venueId: String(show.venueid),
        showDate: show.showdate,
        venueLabel: show.venue,
      });
    } finally {
      setAddingId(null);
    }

    if (result.status === 'added') {
      setRecorded((prev) => new Set(prev).add(String(show.showid)));
    } else if (result.status === 'duplicate') {
      setRecorded((prev) => new Set(prev).add(String(show.showid)));
    } else {
      setError(result.message);
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      closePicker();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      const active = activeIndex >= 0 ? results[activeIndex] : undefined;
      if (active && !recorded.has(String(active.showid))) {
        event.preventDefault();
        handleAdd(active);
      }
    }
  }

  function moveFocus(delta: number) {
    if (results.length === 0) return;
    const next =
      activeIndex < 0
        ? delta > 0
          ? 0
          : results.length - 1
        : Math.min(Math.max(activeIndex + delta, 0), results.length - 1);
    setActiveIndex(next);
  }

  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, input, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName}
        onClick={openPicker}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="picker-scrim" onPointerDown={closePicker}>
          <div
            className="picker-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Add a show"
            ref={panelRef}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="picker-panel__head">
              <h2 className="picker-panel__title">Add a show</h2>
              <span className="picker-panel__from">from the Phish.net archive</span>
              <button
                type="button"
                className="picker-panel__close"
                aria-label="Close"
                onClick={closePicker}
              >
                &times;
              </button>
            </div>

            <div className="picker-panel__body">
              <div className="picker-field">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  value={query}
                  placeholder="Search by date or venue"
                  aria-label="Search by date or venue"
                  aria-expanded={status === 'done' && results.length > 0}
                  aria-controls={status === 'done' && results.length > 0 ? listId : undefined}
                  aria-activedescendant={
                    activeIndex >= 0 && results[activeIndex]
                      ? optionId(results[activeIndex])
                      : undefined
                  }
                  aria-autocomplete="list"
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onKeyDown={onInputKeyDown}
                />
              </div>
              <p className="picker-hint">Type a date or a venue to find a show.</p>

              {error ? (
                <p className="picker-error" role="alert">
                  {error}
                </p>
              ) : null}

              {status === 'idle' ? null : status === 'loading' ? (
                <p className="picker-status" role="status">
                  Searching the archive…
                </p>
              ) : results.length === 0 ? (
                <div className="picker-empty">
                  <p>
                    No shows match <span className="picker-empty__q">&ldquo;{query.trim()}&rdquo;</span>.
                  </p>
                  <p>Try a date or a venue.</p>
                </div>
              ) : (
                <ul className="picker-results" id={listId} role="listbox">
                  {results.map((show, index) => {
                    const id = String(show.showid);
                    const isRecorded = recorded.has(id);
                    const isAdding = addingId === id;
                    return (
                      <li
                        key={id}
                        className="picker-result"
                        id={optionId(show)}
                        role="option"
                        aria-selected={index === activeIndex}
                      >
                        <time className="picker-result__date">{toMMDDYY(show.showdate)}</time>
                        <span className="picker-result__loc">
                          <span className="picker-result__venue">{show.venue}</span>
                          <span className="picker-result__city">
                            {show.city}
                            {show.state ? `, ${show.state}` : ''}
                          </span>
                        </span>
                        {isRecorded ? (
                          <span className="picker-result__taken">Already in your history.</span>
                        ) : (
                          <button
                            type="button"
                            className="picker-result__add"
                            data-add
                            disabled={isAdding}
                            onClick={() => handleAdd(show)}
                          >
                            {isAdding ? 'Pulling setlist…' : 'Add'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
