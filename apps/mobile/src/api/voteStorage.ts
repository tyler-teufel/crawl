import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_VOTE_DAY_TIMEZONE, voteDayFor } from '@crawl/shared-types';
import { VoteState } from '@/types/venue';

// Persists the MOCK vote state so query refetches (staleTime expiry, cache GC,
// city switches) don't reset a user's accumulated daily votes. Entries are
// scoped by today's date only (GLOBAL across cities), mirroring the server's
// `today()` scoping in apps/api/src/services/vote.service.ts, which has no
// city dimension. Delete this module when the real API backs vote state.

const STORAGE_KEY = 'crawl.mockVoteState.v1';

// Same vote-day convention as the server's vote.service.ts `today()`: a
// 04:00-local rollover rather than the raw UTC calendar date (#64). Mobile
// doesn't resolve a per-city timezone yet, so this falls back to the same
// default the API uses.
const todayKey = () => voteDayFor(new Date(), DEFAULT_VOTE_DAY_TIMEZONE);

interface PersistedVoteState {
  date: string;
  state: VoteState;
}

// A corrupted/unparsable entry is treated as absent so reads fall back to the
// default and — critically — the next write overwrites the corruption instead
// of throwing before setItem and failing forever.
function safeParse(raw: string | null): PersistedVoteState | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedVoteState;
  } catch {
    return null;
  }
}

export async function readPersistedVoteState(): Promise<VoteState | null> {
  try {
    const persisted = safeParse(await AsyncStorage.getItem(STORAGE_KEY));
    // Day rollover: yesterday's entry no longer applies — caller falls back to
    // a fresh default state.
    if (!persisted || persisted.date !== todayKey()) return null;
    return persisted.state;
  } catch {
    return null;
  }
}

/**
 * Drops the persisted entry. The key is device-scoped, not user-scoped, so
 * whoever signs in next would otherwise inherit the previous user's votes —
 * exactly what happened when an anonymous session's votes survived a sign-in
 * with Apple. Called from AuthContext whenever the signed-in user changes.
 */
export async function clearPersistedVoteState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort, same rationale as writePersistedVoteState below.
  }
}

export async function writePersistedVoteState(state: VoteState): Promise<void> {
  try {
    const next: PersistedVoteState = { date: todayKey(), state };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: if persistence fails the mock layer still works off the
    // query cache for the current session.
  }
}
