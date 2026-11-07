import 'server-only';
import { loadEnv, type Env } from './env-core';

export type { Env } from './env-core';

/**
 * Server-only env access (AD-1). Importing this module eagerly validates the
 * environment and throws a clear, non-secret error when PHISHNET_API_KEY or
 * DATABASE_URL is missing. `instrumentation.ts` also calls loadEnv at startup
 * so the server fails fast before serving, independent of this module.
 */
export const env: Env = loadEnv(process.env);
