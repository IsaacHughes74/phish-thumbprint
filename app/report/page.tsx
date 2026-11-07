import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, resolveSessionToUserId } from '../../lib/auth';
import { BrandMark } from '../../components/brand-mark';
import { AccountMenu } from '../../components/account-menu';
import { EmptyState } from '../../components/empty-state';

/**
 * Session-gated Report (AD-5, no middleware wall in v1). An unauthenticated
 * request redirects to the Landing `/`. A signed-in Phan resolves to the app
 * `USER.id` (idempotent upsert on first load) and sees the empty Report:
 * masthead + account menu + "Add your first show" empty state. The donate
 * footer renders via the root layout.
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
        <EmptyState />
      </main>
    </div>
  );
}
