import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addShowToHistory,
  getShowHistory,
  removeShowFromHistory,
  type AddShowInput,
  type HistoryDeps,
  type ShowHistoryRow,
} from './history-core';

/**
 * In-memory deps that mirror the Drizzle `insert`/`select`/`delete` semantics,
 * including the `(user_id, phishnet_show_id)` unique constraint (AD-2), so the
 * dedupe/remove/ordering logic is unit-tested without a live database.
 */
function memoryDeps(): HistoryDeps & { rows: ShowHistoryRow[] } {
  const rows: ShowHistoryRow[] = [];
  const deps: HistoryDeps & { rows: ShowHistoryRow[] } = {
    rows,
    async listByUser(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async insertShow(input) {
      const exists = rows.some(
        (row) => row.userId === input.userId && row.phishnetShowId === input.showId,
      );
      if (exists) {
        return { inserted: false };
      }
      rows.push({
        id: `id-${rows.length + 1}`,
        userId: input.userId,
        phishnetShowId: input.showId,
        phishnetVenueId: input.venueId,
        showDate: input.showDate,
        venueLabel: input.venueLabel,
      });
      return { inserted: true };
    },
    async deleteShow(userId, showId) {
      const index = rows.findIndex(
        (row) => row.userId === userId && row.phishnetShowId === showId,
      );
      if (index === -1) {
        return { deleted: false };
      }
      rows.splice(index, 1);
      return { deleted: true };
    },
  };
  return deps;
}

const sample: AddShowInput = {
  userId: 'user-1',
  showId: '1251937496',
  venueId: '100',
  showDate: '2026-07-18',
  venueLabel: 'The Mann Center',
};

test('addShowToHistory inserts a row and returns "added"', async () => {
  const deps = memoryDeps();
  assert.equal(await addShowToHistory(sample, deps), 'added');
  assert.equal(deps.rows.length, 1);
  assert.equal(deps.rows[0].phishnetShowId, sample.showId);
});

test('addShowToHistory rejects a duplicate as "duplicate" without a second row', async () => {
  const deps = memoryDeps();
  await addShowToHistory(sample, deps);
  assert.equal(await addShowToHistory(sample, deps), 'duplicate');
  assert.equal(deps.rows.length, 1);
});

test('getShowHistory orders newest-first (by date, then show id)', async () => {
  const deps = memoryDeps();
  await addShowToHistory({ ...sample, showId: '1', showDate: '2025-08-01' }, deps);
  await addShowToHistory({ ...sample, showId: '2', showDate: '2026-07-18' }, deps);
  await addShowToHistory({ ...sample, showId: '3', showDate: '2026-07-18' }, deps);

  const history = await getShowHistory('user-1', deps);
  assert.deepEqual(
    history.map((row) => row.phishnetShowId),
    ['3', '2', '1'],
  );
});

test('getShowHistory scopes rows to the user', async () => {
  const deps = memoryDeps();
  await addShowToHistory(sample, deps);
  await addShowToHistory({ ...sample, userId: 'user-2', showId: '999' }, deps);

  const history = await getShowHistory('user-1', deps);
  assert.equal(history.length, 1);
  assert.equal(history[0].phishnetShowId, sample.showId);
});

test('removeShowFromHistory deletes the row and returns true', async () => {
  const deps = memoryDeps();
  await addShowToHistory(sample, deps);

  assert.equal(await removeShowFromHistory('user-1', sample.showId, deps), true);
  assert.equal(deps.rows.length, 0);
});

test('removeShowFromHistory returns false when no matching row exists', async () => {
  const deps = memoryDeps();
  assert.equal(await removeShowFromHistory('user-1', 'nope', deps), false);
});
