import { defineConfig } from 'drizzle-kit';

// `generate` is offline (reads db/schema.ts and emits SQL) and does not need a
// live database. The placeholder URL below keeps the config valid when
// DATABASE_URL is unset; `db:migrate` (and `db:push`) require a real value.
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/phish_thumbprint',
  },
});
