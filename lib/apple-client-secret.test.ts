import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  decodeProtectedHeader,
  decodeJwt,
} from 'jose';
import {
  generateAppleClientSecret,
  buildAppleProviderConfig,
  hasAppleCredentials,
  normalizePrivateKey,
  APPLE_TOKEN_AUDIENCE,
  APPLE_CLIENT_SECRET_TTL_SECONDS,
  APPLE_CREDENTIAL_KEYS,
  type AppleCredentials,
} from './apple-client-secret';

test('normalizePrivateKey turns literal \\n escapes into real newlines', () => {
  assert.equal(
    normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----'),
    '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  );
});

test('buildAppleProviderConfig disables the provider when any credential is missing/empty', async () => {
  // Missing most credentials.
  assert.deepEqual(await buildAppleProviderConfig({ APPLE_CLIENT_ID: 'c' }), {
    clientId: '',
    enabled: false,
  });
  assert.deepEqual(await buildAppleProviderConfig({}), { clientId: '', enabled: false });

  // A present-but-empty (whitespace) credential also disables.
  assert.deepEqual(
    await buildAppleProviderConfig({
      APPLE_CLIENT_ID: '   ',
      APPLE_TEAM_ID: 't',
      APPLE_KEY_ID: 'k',
      APPLE_PRIVATE_KEY: 'p',
    }),
    { clientId: '', enabled: false },
  );
});

test('buildAppleProviderConfig mints a client secret when all credentials are present', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const pkcs8 = await exportPKCS8(privateKey);

  const config = await buildAppleProviderConfig({
    APPLE_CLIENT_ID: 'com.example.app',
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY456',
    APPLE_PRIVATE_KEY: pkcs8,
  });

  assert.equal(config.clientId, 'com.example.app');
  assert.equal(config.enabled, undefined);
  assert.ok(config.clientSecret);
  await jwtVerify(config.clientSecret!, publicKey, { algorithms: ['ES256'] });
});

test('generateAppleClientSecret signs a valid ES256 JWT with the right claims', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const pkcs8 = await exportPKCS8(privateKey);

  const creds: AppleCredentials = {
    clientId: 'com.example.app',
    teamId: 'TEAM123',
    keyId: 'KEY456',
    privateKey: pkcs8,
  };

  const now = 1_700_000_000;
  const token = await generateAppleClientSecret(creds, now);

  // Header: ES256 + kid.
  const header = decodeProtectedHeader(token);
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, 'KEY456');

  // Payload claims.
  const payload = decodeJwt(token);
  assert.equal(payload.iss, 'TEAM123');
  assert.equal(payload.sub, 'com.example.app');
  assert.equal(payload.aud, APPLE_TOKEN_AUDIENCE);
  assert.equal(payload.iat, now);
  assert.equal(payload.exp, now + APPLE_CLIENT_SECRET_TTL_SECONDS);

  // The token verifies against the matching public key (verified at `now`).
  await jwtVerify(token, publicKey, {
    algorithms: ['ES256'],
    currentDate: new Date(now * 1000),
  });
});

test('generateAppleClientSecret accepts a private key with literal \\n escapes', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const pkcs8 = await exportPKCS8(privateKey);
  // Simulate a dotenv unquoted multi-line value: escape every newline.
  const escaped = pkcs8.replace(/\n/g, '\\n');

  const creds: AppleCredentials = {
    clientId: 'c',
    teamId: 't',
    keyId: 'k',
    privateKey: escaped,
  };

  const token = await generateAppleClientSecret(creds);
  await jwtVerify(token, publicKey, { algorithms: ['ES256'] });
});

test('generateAppleClientSecret throws a clear error for an invalid private key', async () => {
  const creds: AppleCredentials = {
    clientId: 'c',
    teamId: 't',
    keyId: 'k',
    privateKey: 'not-a-pem',
  };
  await assert.rejects(() => generateAppleClientSecret(creds), /Invalid APPLE_PRIVATE_KEY/);
});

test('APPLE_CREDENTIAL_KEYS matches the documented Apple env contract', () => {
  assert.deepEqual(APPLE_CREDENTIAL_KEYS, [
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
  ]);
});

test('hasAppleCredentials is true only when every credential is present', () => {
  const complete = {
    APPLE_CLIENT_ID: 'c',
    APPLE_TEAM_ID: 't',
    APPLE_KEY_ID: 'k',
    APPLE_PRIVATE_KEY: 'p',
  };
  assert.equal(hasAppleCredentials(complete), true);

  assert.equal(hasAppleCredentials({ ...complete, APPLE_PRIVATE_KEY: '' }), false);
  assert.equal(hasAppleCredentials({ ...complete, APPLE_PRIVATE_KEY: '   ' }), false);
  assert.equal(hasAppleCredentials({}), false);
  assert.equal(hasAppleCredentials({ APPLE_CLIENT_ID: 'c' }), false);
});
