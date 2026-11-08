import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, resolveSessionToUserId } from '../../lib/auth';
import { getShowHistory } from '../../lib/history';
import { BrandMark } from '../../components/brand-mark';
import { AccountMenu } from '../../components/account-menu';
import { EmptyState } from '../../components/empty-state';
import { ReportBody } from '../../components/report-body';
import { ReportSkeleton } from '../../components/report-skeleton';

/**
 * Session-gated Report (AD-5, no middleware wall in v1). An unauthenticated
 * request redirects to the Landing `/`. A signed-in Phan with no Shows sees the
 * "Add your first show" empty state; otherwise the Report body streams in
 * behind a skeleton (EXPERIENCE.md §Cold load). The masthead and the empty
 * check stay in the static shell; the heavy phish.net work lives inside the
 * `<Suspense>` boundary in `ReportBody`.
 */
export default async function ReportPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/');
  }

  const userId = await resolveSessionToUserId(session.session);
  if (!userId) {
    redirect('/');
  }

  const history = await getShowHistory(userId);

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
          <Suspense fallback={<ReportSkeleton />}>
            <ReportBody history={history} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
