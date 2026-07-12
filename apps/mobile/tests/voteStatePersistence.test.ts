import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression tests for the daily vote count reset bug (#45): the mock vote
// state used to live only in the React Query cache, so any refetch returned
// the hardcoded default (3 remaining / 0 voted). It is now persisted per
// date + city via AsyncStorage, mocked here with an in-memory map.

import { getMockVoteState, castMockVote, removeMockVote, DEFAULT_VOTE_STATE } from '@/api/votes';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

const CITY = 'Charlotte, NC';

beforeEach(() => {
  storage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mock vote state persistence', () => {
  it('persists cast votes across a simulated refetch (queryFn re-invocation)', async () => {
    await castMockVote(CITY, 'v1');
    await castMockVote(CITY, 'v2');
    await castMockVote(CITY, 'v3');

    // A refetch re-invokes the queryFn, which reads the persisted store.
    const refetched = await getMockVoteState(CITY);
    expect(refetched).not.toEqual(DEFAULT_VOTE_STATE);
    expect(refetched.remainingVotes).toBe(0);
    expect(refetched.votedVenueIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('rejects a 4th vote without resetting the count', async () => {
    await castMockVote(CITY, 'v1');
    await castMockVote(CITY, 'v2');
    await castMockVote(CITY, 'v3');

    const afterFourth = await castMockVote(CITY, 'v4');
    expect(afterFourth.remainingVotes).toBe(0);
    expect(afterFourth.votedVenueIds).toEqual(['v1', 'v2', 'v3']);

    const refetched = await getMockVoteState(CITY);
    expect(refetched.remainingVotes).toBe(0);
    expect(refetched.votedVenueIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('returns a fresh default state after day rollover', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    await castMockVote(CITY, 'v1');
    expect((await getMockVoteState(CITY)).remainingVotes).toBe(2);

    vi.setSystemTime(new Date('2026-07-10T00:00:01Z'));
    expect(await getMockVoteState(CITY)).toEqual(DEFAULT_VOTE_STATE);
  });

  it('scopes persisted state per city', async () => {
    await castMockVote(CITY, 'v1');
    expect(await getMockVoteState('Raleigh, NC')).toEqual(DEFAULT_VOTE_STATE);
    expect((await getMockVoteState(CITY)).remainingVotes).toBe(2);
  });

  it('overwrites a corrupted storage entry on the next write', async () => {
    storage.set('crawl.mockVoteState.v1', 'not-json{');

    const after = await castMockVote(CITY, 'v1');
    expect(after.remainingVotes).toBe(2);

    const refetched = await getMockVoteState(CITY);
    expect(refetched.remainingVotes).toBe(2);
    expect(refetched.votedVenueIds).toEqual(['v1']);
  });

  it('persists vote removal so a refetch restores the returned vote', async () => {
    await castMockVote(CITY, 'v1');
    await castMockVote(CITY, 'v2');
    await removeMockVote(CITY, 'v1');

    const refetched = await getMockVoteState(CITY);
    expect(refetched.remainingVotes).toBe(2);
    expect(refetched.votedVenueIds).toEqual(['v2']);
  });
});
