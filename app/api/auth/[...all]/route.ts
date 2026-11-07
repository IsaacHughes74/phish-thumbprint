import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../lib/auth';

/**
 * Better Auth handler (AD-1 / AD-5). The catch-all route exposes the full auth
 * API (sign-in, callback, session, sign-out) under `/api/auth/*`.
 */
export const { GET, POST } = toNextJsHandler(auth);
