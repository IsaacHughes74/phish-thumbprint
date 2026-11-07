import { loadEnv } from './lib/env-core';

/**
 * Startup-time fail-fast (I/O & Edge-Case Matrix): validate required env
 * before the server begins serving. A missing PHISHNET_API_KEY or DATABASE_URL
 * throws a clear, non-secret error here. BUST_OUT_GAP_THRESHOLD defaults to 50.
 *
 * This runs in the Node.js runtime at server start (not during `next build`),
 * so a greenfield build without secrets still succeeds while a misconfigured
 * server fails immediately.
 */
export async function register() {
  loadEnv(process.env);
}
