import {
  boolean,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Better Auth's own tables, kept in a separate Postgres schema (`auth.*`) so
 * they never collide with the app's canonical `user` table in `public`
 * (ARCHITECTURE-SPINE.md §AD-5). The app `USER` (public.user) is the domain's
 * canonical user (uuid id, unique `apple_sub`); these tables are Better Auth's
 * identity/session storage. `SHOW_HISTORY.user_id` references `public.user.id`,
 * never Better Auth's id.
 *
 * Field names/types mirror Better Auth's canonical Drizzle schema: camelCase
 * property keys mapping to snake_case columns (the drizzle adapter resolves
 * `emailVerified` -> `email_verified`, etc.).
 */

export const authSchema = pgSchema('auth');

export const authUser = authSchema.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const authSession = authSchema.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
});

export const authAccount = authSchema.table('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const authVerification = authSchema.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

/** The model-name map the drizzle adapter expects (`user`/`session`/`account`/`verification`). */
export const authTables = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
};
