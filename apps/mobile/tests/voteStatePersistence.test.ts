import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression tests for the daily vote count reset bug (#45) and the mock/
// server fidelity gaps fixed in #62: the mock vote state used to live only
// in the React Query cache (reset on refetch), and later was scoped
// per-city (granting 3 votes PER CITY instead of the server's global 3
// votes/user/day). It is now persisted per date only via AsyncStorage
// (mocked here with an in-memory map), and exhaustion/duplicate casts throw
// the same VoteError shape the server does instead of silently no-op'ing.

import {
  getMockVoteState,
  castMockVote,
  removeMockVote,
  DEFAULT_VOTE_STATE,
  VoteError,
} from '@/api/votes';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

beforeEach(() => {
  storage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mock vote state persistence', () => {
  it('persists cast votes across a simulated refetch (queryFn re-invocation)', async () => {
    await castMockVote('v1');
    await castMockVote('v2');
    await castMockVote('v3');

    // A refetch re-invokes the queryFn, which reads the persisted store.
    const refetched = await getMockVoteState();
    expect(refetched).not.toEqual(DEFAULT_VOTE_STATE);
    expect(refetched.remainingVotes).toBe(0);
    expect(refetched.votedVenueIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('rejects a 4th vote without resetting the count', async () => {
    await castMockVote('v1');
    await castMockVote('v2');
    await castMockVote('v3');

    await expect(castMockVote('v4')).rejects.toThrow(VoteError);
    await expect(castMockVote('v4')).rejects.toMatchObject({ code: 'NO_VOTES_REMAINING' });

    const refetched = await getMockVoteState();
    expect(refetched.remainingVotes).toBe(0);
    expect(refetched.votedVenueIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('rejects a duplicate vote for the same venue', async () => {
    await castMockVote('v1');

    await expect(castMockVote('v1')).rejects.toThrow(VoteError);
    await expect(castMockVote('v1')).rejects.toMatchObject({ code: 'ALREADY_VOTED' });

    const refetched = await getMockVoteState();
    expect(refetched.remainingVotes).toBe(2);
    expect(refetched.votedVenueIds).toEqual(['v1']);
  });

  it('returns a fresh default state after day rollover', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    await castMockVote('v1');
    expect((await getMockVoteState()).remainingVotes).toBe(2);

    vi.setSystemTime(new Date('2026-07-10T00:00:01Z'));
    expect(await getMockVoteState()).toEqual(DEFAULT_VOTE_STATE);
  });

  it('enforces a GLOBAL 3-votes/day budget shared across cities', async () => {
    // Votes cast while "in" one city and another both draw from the same
    // pool — the server has no city dimension for the vote budget.
    await castMockVote('v1'); // e.g. cast while viewing Charlotte, NC
    await castMockVote('v2'); // e.g. cast while viewing Patchogue, NY
    await castMockVote('v3'); // e.g. cast while viewing Charlotte, NC again

    const state = await getMockVoteState();
    expect(state.remainingVotes).toBe(0);
    expect(state.votedVenueIds).toEqual(['v1', 'v2', 'v3']);

    // A 4th cast, regardless of which city it's associated with, is rejected.
    await expect(castMockVote('v4')).rejects.toMatchObject({ code: 'NO_VOTES_REMAINING' });
  });

  it('overwrites a corrupted storage entry on the next write', async () => {
    storage.set('crawl.mockVoteState.v1', 'not-json{');

    const after = await castMockVote('v1');
    expect(after.remainingVotes).toBe(2);

    const refetched = await getMockVoteState();
    expect(refetched.remainingVotes).toBe(2);
    expect(refetched.votedVenueIds).toEqual(['v1']);
  });

  it('persists vote removal so a refetch restores the returned vote', async () => {
    await castMockVote('v1');
    await castMockVote('v2');
    await removeMockVote('v1');

    const refetched = await getMockVoteState();
    expect(refetched.remainingVotes).toBe(2);
    expect(refetched.votedVenueIds).toEqual(['v2']);
  });
});
