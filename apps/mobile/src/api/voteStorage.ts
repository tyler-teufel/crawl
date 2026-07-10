import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoteState } from '@/types/venue';

// Persists the MOCK vote state so query refetches (staleTime expiry, cache GC,
// city switches) don't reset a user's accumulated daily votes. Entries are
// scoped by today's date + city, mirroring the server's `today()` scoping in
// apps/api/src/services/vote.service.ts. Delete this module when the real API
// backs vote state.

const STORAGE_KEY = 'crawl.mockVoteState.v1';

// Same date-key convention as the server's vote.service.ts `today()`.
const todayKey = () => new Date().toISOString().slice(0, 10);

interface PersistedVoteStates {
  date: string;
  byCity: Record<string, VoteState>;
}

// A corrupted/unparsable entry is treated as absent so reads fall back to the
// default and — critically — the next write overwrites the corruption instead
// of throwing before setItem and failing forever.
function safeParse(raw: string | null): PersistedVoteStates | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedVoteStates;
  } catch {
    return null;
  }
}

export async function readPersistedVoteState(city: string): Promise<VoteState | null> {
  try {
    const persisted = safeParse(await AsyncStorage.getItem(STORAGE_KEY));
    // Day rollover: yesterday's entry no longer applies — caller falls back to
    // a fresh default state.
    if (!persisted || persisted.date !== todayKey()) return null;
    return persisted.byCity[city] ?? null;
  } catch {
    return null;
  }
}

export async function writePersistedVoteState(city: string, state: VoteState): Promise<void> {
  try {
    const today = todayKey();
    const persisted = safeParse(await AsyncStorage.getItem(STORAGE_KEY));
    // Discard stale entries on rollover instead of carrying them forward.
    const byCity = persisted && persisted.date === today ? persisted.byCity : {};
    const next: PersistedVoteStates = { date: today, byCity: { ...byCity, [city]: state } };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: if persistence fails the mock layer still works off the
    // query cache for the current session.
  }
}
