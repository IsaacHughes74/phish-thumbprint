import { createAuthClient } from 'better-auth/react';

/**
 * Browser auth client (AD-1 boundary: this module holds no secrets — it only
 * talks to Better Auth's routes). Imported by client components only; never
 * import `lib/auth` (server-only) or any Apple secret here.
 */
export const authClient = createAuthClient();
