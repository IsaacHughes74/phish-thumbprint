'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '../lib/auth-client';
import { MOCKINGBIRD_DONATE_URL } from './donate-footer';

/**
 * Avatar-triggered account menu (DESIGN.md §account-menu): an amber avatar (no
 * user image yet) opens a menu with sign out, the Mockingbird donate link, and
 * the phish.net attribution. Escape and click/tap-outside close the menu; the
 * avatar button and panel are linked via `aria-controls`. Sign out clears the
 * session and returns to the Landing only on success (EXPERIENCE.md §State
 * Patterns).
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Focus the first menu item when the menu opens (WAI-ARIA menu button).
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  // Escape closes and returns focus to the avatar; a pointer outside closes.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        avatarRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  async function handleSignOut() {
    setError(null);
    try {
      await authClient.signOut();
      setOpen(false);
      router.push('/');
    } catch {
      setError("Couldn't sign out — try again.");
    }
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        ref={avatarRef}
        className="account-menu__avatar"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.7-8 4.5V20h16v-1.5c0-2.8-4.7-4.5-8-4.5z" />
        </svg>
      </button>

      {open ? (
        <div className="account-menu__panel" id={panelId} role="menu" ref={panelRef}>
          {error ? (
            <span className="account-menu__error" role="alert">
              {error}
            </span>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="account-menu__item"
            onClick={handleSignOut}
          >
            Sign out
          </button>
          <a
            role="menuitem"
            className="account-menu__item"
            href={MOCKINGBIRD_DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Donate to the Mockingbird Foundation
          </a>
          <span className="account-menu__attr">courtesy Phish.net / Mockingbird Foundation</span>
        </div>
      ) : null}
    </div>
  );
}
