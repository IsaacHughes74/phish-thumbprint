import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { user } from '../db/schema';
import { authAccount, authTables } from '../db/auth-schema';
import { env } from './env';
import {
  buildAppleProviderConfig,
} from './apple-client-secret';
import {
  resolveUserByAppleSub,
  resolveUserIdFromSession,
  type SessionLike,
} from './resolve-user';

/**
 * Better Auth instance (AD-1 / AD-5): Apple-only, server-side, with a Drizzle
 * adapter over the `auth.*` Postgres schema. Apple secrets are read lazily
 * inside the social-provider config, so a missing key surfaces at sign-in (a
 * clear error), never as a boot crash. On account creation the app `USER` is
 * upserted by `apple_sub` (never a duplicate).
 */

const resolveDeps = {
  findByAppleSub: async (appleSub: string) => {
    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.appleSub, appleSub))
      .limit(1);
    return rows[0];
  },
  insertByAppleSub: async (appleSub: string) => {
    const inserted = await db
      .insert(user)
      .values({ appleSub })
      .onConflictDoNothing({ target: user.appleSub })
      .returning({ id: user.id });
    return inserted[0];
  },
  findAppleAccount: async (baUserId: string) => {
    const rows = await db
      .select({ providerId: authAccount.providerId, accountId: authAccount.accountId })
      .from(authAccount)
      .where(
        and(eq(authAccount.userId, baUserId), eq(authAccount.providerId, 'apple')),
      )
      .limit(1);
    return rows[0];
  },
};

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authTables }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: ['https://appleid.apple.com'],
  socialProviders: {
    apple: () => buildAppleProviderConfig(env),
  },
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          // Only Apple accounts map to the app USER (AD-5).
          if (account.providerId !== 'apple') {
            return;
          }
          await resolveUserByAppleSub(account.accountId, resolveDeps);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

/** Resolve a Better Auth session to the app `USER.id` (AD-5). */
export function resolveSessionToUserId(
  session: SessionLike | null | undefined,
): Promise<string | null> {
  return resolveUserIdFromSession(session, resolveDeps);
}
