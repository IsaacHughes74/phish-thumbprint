import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveUserByAppleSub,
  resolveUserIdFromSession,
  isAppleAccount,
  APPLE_PROVIDER_ID,
  type ResolveUserDeps,
  type ResolveSessionDeps,
} from './resolve-user';

/**
 * In-memory deps that record every insert so tests can assert "no duplicate
 * USER" (the I/O & Edge-Case Matrix's first-sign-in / returning-sign-in rows).
 */
function memoryDeps(): ResolveUserDeps & {
  rows: Map<string, string>;
  inserts: string[];
} {
  const rows = new Map<string, string>(); // appleSub -> id
  const inserts: string[] = [];
  const deps: ResolveUserDeps & { rows: Map<string, string>; inserts: string[] } = {
    rows,
    inserts,
    async findByAppleSub(appleSub) {
      const id = rows.get(appleSub);
      return id === undefined ? undefined : { id };
    },
    async insertByAppleSub(appleSub) {
      inserts.push(appleSub);
      const id = `user-${rows.size + 1}`;
      rows.set(appleSub, id);
      return { id };
    },
  };
  return deps;
}

test('isAppleAccount returns true only for the apple provider', () => {
  assert.equal(isAppleAccount({ providerId: APPLE_PROVIDER_ID }), true);
  assert.equal(isAppleAccount({ providerId: 'google' }), false);
  assert.equal(isAppleAccount(null), false);
  assert.equal(isAppleAccount(undefined), false);
});

test('first sign-in creates a USER and reports created=true', async () => {
  const deps = memoryDeps();
  const { id, created } = await resolveUserByAppleSub('sub-123', deps);
  assert.equal(created, true);
  assert.equal(id, deps.rows.get('sub-123'));
  assert.deepEqual(deps.inserts, ['sub-123']);
});

test('returning sign-in reuses the existing USER without inserting', async () => {
  const deps = memoryDeps();
  await resolveUserByAppleSub('sub-123', deps); // first
  const { id, created } = await resolveUserByAppleSub('sub-123', deps); // returning
  assert.equal(created, false);
  assert.equal(id, deps.rows.get('sub-123'));
  assert.equal(deps.inserts.length, 1); // no duplicate USER
});

test('concurrent insert race re-reads and reuses the winner (no duplicate)', async () => {
  const deps = memoryDeps();
  await resolveUserByAppleSub('sub-123', deps);

  // Simulate a lost insert race: findByAppleSub misses, insert returns
  // undefined (unique-violation), then the follow-up read finds the winner.
  let reads = 0;
  const racedDeps: ResolveUserDeps = {
    async findByAppleSub(appleSub) {
      reads += 1;
      return reads === 1 ? undefined : { id: deps.rows.get(appleSub)! };
    },
    async insertByAppleSub() {
      return undefined;
    },
  };

  const { id, created } = await resolveUserByAppleSub('sub-123', racedDeps);
  assert.equal(created, false);
  assert.equal(id, deps.rows.get('sub-123'));
});

test('upsert fails clearly when no row exists after insert', async () => {
  const deps: ResolveUserDeps = {
    async findByAppleSub() {
      return undefined;
    },
    async insertByAppleSub() {
      return undefined;
    },
  };
  await assert.rejects(() => resolveUserByAppleSub('sub-123', deps), /no row after upsert/);
});

test('resolveUserByAppleSub rejects an empty apple_sub', async () => {
  const deps = memoryDeps();
  await assert.rejects(() => resolveUserByAppleSub('   ', deps), /non-empty apple_sub/);
});

test('resolveUserIdFromSession returns null for a missing session', async () => {
  const deps = memoryDeps();
  const id = await resolveUserIdFromSession(null, { ...deps, findAppleAccount: async () => undefined });
  assert.equal(id, null);
});

test('resolveUserIdFromSession returns null when no Apple account exists', async () => {
  const deps = memoryDeps();
  const id = await resolveUserIdFromSession(
    { userId: 'ba-user-1' },
    { ...deps, findAppleAccount: async () => undefined },
  );
  assert.equal(id, null);
});

test('resolveUserIdFromSession returns null for a non-Apple account', async () => {
  const deps = memoryDeps();
  const id = await resolveUserIdFromSession(
    { userId: 'ba-user-1' },
    {
      ...deps,
      findAppleAccount: async () => ({ providerId: 'google', accountId: 'x' }),
    },
  );
  assert.equal(id, null);
});

test('resolveUserIdFromSession resolves session -> apple_sub -> USER.id', async () => {
  const deps = memoryDeps();
  await resolveUserByAppleSub('sub-123', deps); // pre-existing USER

  const sessionDeps: ResolveSessionDeps = {
    ...deps,
    findAppleAccount: async (baUserId) =>
      baUserId === 'ba-user-1' ? { providerId: 'apple', accountId: 'sub-123' } : undefined,
  };

  const id = await resolveUserIdFromSession({ userId: 'ba-user-1' }, sessionDeps);
  assert.equal(id, deps.rows.get('sub-123'));
});

test('resolveUserIdFromSession returns null for an Apple account with a blank accountId', async () => {
  const deps = memoryDeps();
  const sessionDeps: ResolveSessionDeps = {
    ...deps,
    findAppleAccount: async () => ({ providerId: 'apple', accountId: '   ' }),
  };

  const id = await resolveUserIdFromSession({ userId: 'ba-user-1' }, sessionDeps);
  assert.equal(id, null);
  // No insert was attempted for the blank sub.
  assert.deepEqual(deps.inserts, []);
});

test('resolveUserIdFromSession upserts the USER when the account hook was skipped', async () => {
  const deps = memoryDeps();
  const sessionDeps: ResolveSessionDeps = {
    ...deps,
    findAppleAccount: async () => ({ providerId: 'apple', accountId: 'sub-fresh' }),
  };

  const id = await resolveUserIdFromSession({ userId: 'ba-user-1' }, sessionDeps);
  assert.equal(id, deps.rows.get('sub-fresh'));
  assert.deepEqual(deps.inserts, ['sub-fresh']);
});
