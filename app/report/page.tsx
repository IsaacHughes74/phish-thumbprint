import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, resolveSessionToUserId } from '../../lib/auth';
import { getShowHistory } from '../../lib/history';
import { toMMDDYY } from '../../lib/phishnet/search';
import { BrandMark } from '../../components/brand-mark';
import { AccountMenu } from '../../components/account-menu';
import { EmptyState } from '../../components/empty-state';
import { ShowHistoryStrip } from '../../components/show-history-strip';

/**
 * Session-gated Report (AD-5, no middleware wall in v1). An unauthenticated
 * request redirects to the Landing `/`. A signed-in Phan resolves to the app
 * `USER.id` and sees the empty Report (masthead + "Add your first show" empty
 * state) until they record their first Show, after which the compact
 * Show-history strip renders in its place. The donate footer lives in the root
 * layout.
 */
export default async function ReportPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/');
  }

  // Resolve the session subject to the app USER.id (AD-5); null means no Apple
  // account is attached, which cannot happen for a valid Apple session.
  const userId = await resolveSessionToUserId(session.session);
  if (!userId) {
    redirect('/');
  }

  const history = await getShowHistory(userId);
  const showIds = history.map((row) => row.phishnetShowId);

  return (
    <div className="screen">
      <header className="masthead">
        <div className="brand">
          <BrandMark size={34} className="brand-mark" />
          <span className="brand-wordmark">Phish Thumbprint</span>
        </div>
        <AccountMenu />
      </header>

      <main>
        {history.length === 0 ? (
          <EmptyState />
        ) : (
          <ShowHistoryStrip
            count={history.length}
            since={toMMDDYY(history[history.length - 1].showDate)}
            showIds={showIds}
          />
        )}
      </main>
    </div>
  );
}
