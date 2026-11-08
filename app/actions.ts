'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, resolveSessionToUserId } from '../lib/auth';
import {
  addShowToHistory,
  removeShowFromHistory,
} from '../lib/history';
import { getSetlist, searchShows as searchShowsCatalog } from '../lib/phishnet';
import type { ShowRecord } from '../lib/phishnet/types';

/**
 * Server Actions — the only write surfaces for Show History (AD-2) and the
 * server-only door the picker reaches phish.net through (AD-1/AD-3). Every
 * action resolves the session to the app `USER.id` server-side and revalidates
 * `/report` and `/history` after a mutation so the surfaces stay consistent.
 */

const SEARCH_RESULT_LIMIT = 100;

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error('Unauthorized');
  }
  const userId = await resolveSessionToUserId(session.session);
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export interface AddShowInput {
  showId: string;
  venueId: string;
  showDate: string;
  venueLabel: string;
}

export type AddShowResult =
  | { status: 'added' }
  | { status: 'duplicate'; message: string }
  | { status: 'error'; message: string };

export type RemoveShowResult =
  | { status: 'removed'; message: string }
  | { status: 'error'; message: string };

export async function addShow(input: AddShowInput): Promise<AddShowResult> {
  const showId = input.showId?.trim();
  const venueId = input.venueId?.trim();
  const showDate = input.showDate?.trim();
  const venueLabel = input.venueLabel?.trim();

  if (!showId || !venueId || !showDate || !venueLabel) {
    return { status: 'error', message: 'Invalid show.' };
  }

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { status: 'error', message: "Couldn't add the show — sign in first." };
  }

  let result: 'added' | 'duplicate';
  try {
    result = await addShowToHistory({ userId, showId, venueId, showDate, venueLabel });
  } catch {
    return { status: 'error', message: "Couldn't add the show — try again." };
  }

  if (result === 'duplicate') {
    return { status: 'duplicate', message: 'Already in your history.' };
  }

  // Best-effort Setlist pull (FR-4/FR-5): a missing/empty/rate-limited Setlist
  // never blocks the Show from landing — swallow every failure here.
  try {
    await getSetlist(showId);
  } catch {
    // Setlist unavailable; the Show is already recorded.
  }

  revalidatePath('/report');
  revalidatePath('/history');
  return { status: 'added' };
}

export async function removeShow(showId: string): Promise<RemoveShowResult> {
  const id = showId?.trim();
  if (!id) {
    return { status: 'error', message: 'Invalid show.' };
  }

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { status: 'error', message: "Couldn't remove the show — sign in first." };
  }

  try {
    await removeShowFromHistory(userId, id);
  } catch {
    return { status: 'error', message: "Couldn't remove the show — try again." };
  }

  revalidatePath('/report');
  revalidatePath('/history');
  return { status: 'removed', message: 'Removed from your history.' };
}

export async function searchShows(query: string): Promise<ShowRecord[]> {
  await requireUserId();
  const results = await searchShowsCatalog(query);
  return results.slice(0, SEARCH_RESULT_LIMIT);
}
