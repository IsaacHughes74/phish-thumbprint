import { importPKCS8, SignJWT } from 'jose';

/**
 * Apple Sign-in client-secret minting (server-only). Apple requires an ES256
 * JWT for the token endpoint: `kid` = key id, `iss` = team id, `sub` = client
 * id, `aud` = https://appleid.apple.com, ~180-day expiry (regenerated ≤ every
 * 6 months — ARCHITECTURE-SPINE.md operational envelope).
 */

export const APPLE_TOKEN_AUDIENCE = 'https://appleid.apple.com';

/** ~180 days, in seconds. */
export const APPLE_CLIENT_SECRET_TTL_SECONDS = 15552000;

export interface AppleCredentials {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}

export const APPLE_CREDENTIAL_KEYS = [
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
] as const;

export type AppleCredentialKey = (typeof APPLE_CREDENTIAL_KEYS)[number];

/** The optional Apple credential fields exposed on `Env`. */
export type AppleCredentialSource = {
  [K in AppleCredentialKey]?: string | undefined;
};

/**
 * Normalize a PEM that may carry literal `\n` escapes (common when a `.p8`
 * private key is stored unquoted in a dotenv file) into real newlines.
 */
export function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n');
}

/**
 * True when every Apple credential is present and non-empty. Used to gate the
 * Apple provider at init: with no creds the provider is disabled (so the app
 * boots/builds) rather than throwing at boot.
 */
export function hasAppleCredentials(source: AppleCredentialSource): boolean {
  return APPLE_CREDENTIAL_KEYS.every(
    (name) => source[name] && source[name]!.trim() !== '',
  );
}

/** The resolved Better Auth Apple provider config. */
export interface AppleProviderConfig {
  clientId: string;
  /** `false` when the provider is disabled (missing/invalid creds). */
  enabled?: boolean;
  clientSecret?: string;
}

/**
 * Compose the Better Auth Apple provider config. Disabled (`enabled: false`)
 * when any credential is missing/empty — so a missing key never crashes
 * `betterAuth()` init, and a sign-in attempt surfaces the generic failure copy.
 * Enabled with a minted client secret when all are present.
 */
export async function buildAppleProviderConfig(
  source: AppleCredentialSource,
): Promise<AppleProviderConfig> {
  if (!hasAppleCredentials(source)) {
    return { clientId: '', enabled: false };
  }
  const creds: AppleCredentials = {
    clientId: source.APPLE_CLIENT_ID!,
    teamId: source.APPLE_TEAM_ID!,
    keyId: source.APPLE_KEY_ID!,
    privateKey: source.APPLE_PRIVATE_KEY!,
  };
  const clientSecret = await generateAppleClientSecret(creds);
  return { clientId: creds.clientId, clientSecret };
}

/**
 * Mint the ES256 client-secret JWT. `nowSeconds` is injectable for deterministic
 * tests; defaults to the current time.
 */
export async function generateAppleClientSecret(
  creds: AppleCredentials,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  let key: Awaited<ReturnType<typeof importPKCS8>>;
  try {
    key = await importPKCS8(normalizePrivateKey(creds.privateKey), 'ES256');
  } catch {
    throw new Error('Invalid APPLE_PRIVATE_KEY');
  }
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: creds.keyId })
    .setIssuer(creds.teamId)
    .setSubject(creds.clientId)
    .setAudience(APPLE_TOKEN_AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + APPLE_CLIENT_SECRET_TTL_SECONDS)
    .sign(key);
}
