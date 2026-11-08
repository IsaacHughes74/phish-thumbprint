import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, resolveSessionToUserId } from '../../lib/auth';
import { getShowHistory } from '../../lib/history';
import { toMMDDYY } from '../../lib/phishnet/search';
import { BrandMark } from '../../components/brand-mark';
import { AccountMenu } from '../../components/account-menu';
import { AddShowPicker } from '../../components/add-show-picker';
import { ShowHistoryRow } from '../../components/show-history-row';

/**
 * Session-gated Show history surface (AD-5, page-level check like Story 2):
 * unauthenticated requests redirect to `/`. A signed-in Phan sees their
 * recorded Shows newest-first (FR-7), each removable via `removeShow`, plus an
 * "Add a show" picker. Reached from the Report's summary strip.
 */
export default async function HistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/');
  }

  const userId = await resolveSessionToUserId(session.session);
  if (!userId) {
    redirect('/');
  }

  const history = await getShowHistory(userId);
  const showIds = history.map((row) => row.phishnetShowId);
  const earliest = history.length > 0 ? toMMDDYY(history[history.length - 1].showDate) : null;

  return (
    <div className="screen">
      <header className="masthead">
        <div className="brand">
          <BrandMark size={34} className="brand-mark" />
          <span className="brand-wordmark">Phish Thumbprint</span>
        </div>
        <AccountMenu />
      </header>

      <div className="history-head">
        <Link className="history-head__back" href="/report">
          &larr; Report
        </Link>
        <h1 className="history-head__title">Show history</h1>
        <span className="history-head__count">
          {history.length} show{history.length === 1 ? '' : 's'}
          {earliest ? (
            <>
              <span className="history-head__sep">&middot;</span>
              <span className="history-head__since">since {earliest}</span>
            </>
          ) : null}
        </span>
        <AddShowPicker
          triggerLabel="+ Add a show"
          triggerClassName="btn-primary"
          recordedShowIds={showIds}
        />
      </div>

      <div className="history-list-wrap">
        {history.length === 0 ? (
          <p className="history-empty">Nothing here yet — add a show to start your history.</p>
        ) : (
          <>
            <p className="history-list-note">Newest first</p>
            <ul className="history-list">
              {history.map((row) => (
                <ShowHistoryRow
                  key={row.phishnetShowId}
                  showId={row.phishnetShowId}
                  date={toMMDDYY(row.showDate)}
                  venue={row.venueLabel}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
