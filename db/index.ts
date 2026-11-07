import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '../lib/env';

// Server-only boundary (AD-1): the Neon connection string never reaches the
// browser. Importing this module eagerly evaluates lib/env and fails fast if
// DATABASE_URL is missing.
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
