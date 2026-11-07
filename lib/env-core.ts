/**
 * Pure, dependency-free env validation. Split out from `lib/env.ts` (which
 * adds `import 'server-only'`) so the fail-fast logic is unit-testable without
 * a live environment or a Next.js bundler.
 */

export const DEFAULT_BUST_OUT_GAP_THRESHOLD = 50;

export interface Env {
  /** phish.net v5 API key (read from process.env['PHISHNET_API_KEY']). */
  PHISHNET_API_KEY: string;
  DATABASE_URL: string;
  BUST_OUT_GAP_THRESHOLD: number;
}

/**
 * A plain map of env values. Kept independent of `NodeJS.ProcessEnv` (which
 * Next.js augments with additional required keys at build time) so the pure
 * loader stays simple to construct in tests.
 */
export type EnvSource = Record<string, string | undefined>;

/** Env var names that must be present for the server to boot. */
const REQUIRED_VARS = ['PHISHNET_API_KEY', 'DATABASE_URL'] as const;

export function loadEnv(env: EnvSource = process.env): Env {
  const missing = REQUIRED_VARS.filter(
    (name) => !env[name] || env[name]!.trim() === '',
  );

  if (missing.length > 0) {
    // Clear and non-secret: names only, never the values.
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const rawThreshold = env.BUST_OUT_GAP_THRESHOLD;
  let bustOutGapThreshold = DEFAULT_BUST_OUT_GAP_THRESHOLD;

  if (rawThreshold !== undefined && rawThreshold.trim() !== '') {
    const parsed = Number(rawThreshold);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid BUST_OUT_GAP_THRESHOLD: ${rawThreshold}`);
    }
    bustOutGapThreshold = parsed;
  }

  return {
    PHISHNET_API_KEY: env['PHISHNET_API_KEY']!,
    DATABASE_URL: env.DATABASE_URL!,
    BUST_OUT_GAP_THRESHOLD: bustOutGapThreshold,
  };
}
