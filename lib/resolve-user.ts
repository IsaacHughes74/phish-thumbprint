/**
 * Pure, dependency-free core of AD-5's single user-id seam: resolve an Apple
 * `sub` to the app's canonical `USER.id`, and resolve a Better Auth session to
 * that id. Split from any `db`/`server-only` import (mirrors `lib/env-core.ts`)
 * so the resolve/upsert logic is unit-testable without a live database.
 *
 * The app's `USER` table is the domain's canonical user (uuid id, unique
 * `apple_sub`); Better Auth keeps its own identity tables in `auth.*`. Domain
 * code and `SHOW_HISTORY.user_id` reference `USER.id` only, never the Apple
 * `sub` or Better Auth's user id.
 */

/** The Apple provider id Better Auth stores on an `account` row. */
export const APPLE_PROVIDER_ID = 'apple';

export interface AppleAccountLike {
  /** Better Auth `account.providerId`. */
  providerId: string;
  /** Better Auth `account.accountId` — the Apple `sub` for Apple accounts. */
  accountId: string;
}

export interface SessionLike {
  /** Better Auth `session.userId` (the Better Auth user id, not the app USER id). */
  userId: string;
}

export interface ResolveUserDeps {
  /** Look up an app `USER` row by its unique `apple_sub`. */
  findByAppleSub: (appleSub: string) => Promise<{ id: string } | undefined>;
  /**
   * Insert an app `USER` row for an `apple_sub`. Returns the new row, or
   * `undefined` when a concurrent insert won (the caller then re-reads).
   */
  insertByAppleSub: (appleSub: string) => Promise<{ id: string } | undefined>;
}

export interface ResolveSessionDeps extends ResolveUserDeps {
  /** Find the Apple account attached to a Better Auth user id. */
  findAppleAccount: (baUserId: string) => Promise<AppleAccountLike | undefined>;
}

export function isAppleAccount(
  account: Pick<AppleAccountLike, 'providerId'> | null | undefined,
): boolean {
  return account?.providerId === APPLE_PROVIDER_ID;
}

/**
 * Resolve (or create) the app `USER` for an Apple `sub`. Idempotent: never
 * returns a duplicate `USER` — a concurrent first-sign-in that loses the
 * insert race re-reads and reuses the winner's row.
 */
export async function resolveUserByAppleSub(
  appleSub: string,
  deps: ResolveUserDeps,
): Promise<{ id: string; created: boolean }> {
  const sub = appleSub?.trim();
  if (!sub) {
    throw new Error('resolveUserByAppleSub requires a non-empty apple_sub');
  }

  const existing = await deps.findByAppleSub(sub);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const inserted = await deps.insertByAppleSub(sub);
  if (inserted) {
    return { id: inserted.id, created: true };
  }

  // Lost the insert race to a concurrent sign-in: reuse the winner's row.
  const winner = await deps.findByAppleSub(sub);
  if (winner) {
    return { id: winner.id, created: false };
  }

  throw new Error('Failed to resolve USER for apple_sub (no row after upsert)');
}

/**
 * Session → Apple `sub` → app `USER.id` (AD-5). Returns `null` for a missing
 * session or a session with no Apple account. If the app `USER` row is missing
 * (e.g. the account-create hook was skipped), it is upserted here so first
 * sign-in is idempotent on session load.
 */
export async function resolveUserIdFromSession(
  session: SessionLike | null | undefined,
  deps: ResolveSessionDeps,
): Promise<string | null> {
  if (!session?.userId) {
    return null;
  }

  const account = await deps.findAppleAccount(session.userId);
  if (!account || !isAppleAccount(account)) {
    return null;
  }

  const appleSub = account.accountId?.trim();
  if (!appleSub) {
    return null;
  }

  const resolved = await resolveUserByAppleSub(appleSub, deps);
  return resolved.id;
}
