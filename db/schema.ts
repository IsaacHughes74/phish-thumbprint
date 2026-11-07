import {
  date,
  json,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Core entities (ARCHITECTURE-SPINE.md §Structural Seed).
 *
 * - USER: uuid PK + unique `apple_sub` (the Apple identity seam, AD-5).
 * - SHOW_HISTORY: uuid PK, FK to USER, unique on (user_id, phishnet_show_id)
 *   (AD-2 — duplicate-show prevention is a DB constraint, not a UI check).
 * - PHISH_CACHE: `key` PK, `data` json, `fetched_at` timestamp (AD-3 read-through
 *   mirror; never a source of truth).
 */

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  appleSub: text('apple_sub').notNull().unique(),
});

export const showHistory = pgTable(
  'show_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    phishnetShowId: text('phishnet_show_id').notNull(),
    phishnetVenueId: text('phishnet_venue_id').notNull(),
    showDate: date('show_date', { mode: 'string' }).notNull(),
    venueLabel: text('venue_label').notNull(),
  },
  (table) => ({
    userShowUnique: uniqueIndex('show_history_user_show_unique').on(
      table.userId,
      table.phishnetShowId,
    ),
  }),
);

export const phishCache = pgTable('phish_cache', {
  key: text('key').primaryKey(),
  data: json('data').notNull().$type<unknown>(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
});
