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
import { readPersistedVoteState } from '@/api/voteStorage';
import { DEFAULT_VOTE_DAY_TIMEZONE, voteDayFor } from '@crawl/shared-types';

// @/api/votes imports venueKeys from @/api/venues, which now has a
// Supabase-direct read branch — mock the client so this test doesn't pull in
// the real react-native-url-polyfill/@supabase/supabase-js chain.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

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
    // The vote day rolls over at 04:00 America/New_York (#64), i.e. 08:00 UTC
    // during EDT — not raw UTC midnight.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z')); // 08:00 EDT, vote day 2026-07-09
    await castMockVote('v1');
    expect((await getMockVoteState()).remainingVotes).toBe(2);

    vi.setSystemTime(new Date('2026-07-09T23:59:59Z')); // 19:59:59 EDT, still vote day 2026-07-09
    expect((await getMockVoteState()).remainingVotes).toBe(2);

    vi.setSystemTime(new Date('2026-07-10T08:00:01Z')); // 04:00:01 EDT, vote day 2026-07-10
    expect(await getMockVoteState()).toEqual(DEFAULT_VOTE_STATE);
  });

  it('scopes a vote cast just before the 04:00-local boundary to the pre-boundary vote day, and one cast just after to a fresh vote day', async () => {
    vi.useFakeTimers();

    // 01:00 EDT Saturday — post-midnight nightlife, but still "Friday night"
    // under the 04:00 cutoff (#64).
    vi.setSystemTime(new Date('2026-07-11T05:00:00Z'));
    await castMockVote('v1');
    await castMockVote('v2');
    expect((await getMockVoteState()).remainingVotes).toBe(1);

    // One second before the boundary: still the same vote day, budget carries.
    vi.setSystemTime(new Date('2026-07-11T07:59:59Z'));
    expect((await getMockVoteState()).remainingVotes).toBe(1);

    // One second after the boundary (04:00:01 EDT Saturday): a new vote day,
    // budget is fresh again.
    vi.setSystemTime(new Date('2026-07-11T08:00:01Z'));
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

  it('removing a venue that was never voted for is a no-op, not an error', async () => {
    await castMockVote('v1');

    const result = await removeMockVote('not-voted-for');
    expect(result.remainingVotes).toBe(2);
    expect(result.votedVenueIds).toEqual(['v1']);
  });

  it('falls back to the default state instead of crashing when the storage still holds the old per-city shape ({ date, byCity }) from before #62', async () => {
    // Pre-#62 persisted shape: { date, byCity: Record<string, VoteState> }.
    // Simulates a device that voted today under the old app version and then
    // received the #62 update before its next vote-state read.
    //
    // `date` must be today's *vote day* (voteDayFor, the #64 04:00-local
    // boundary), not the raw UTC calendar date — voteStorage.ts's todayKey()
    // computes the former, and the two only coincide after 4am ET. Using the
    // raw date here made this test flaky: it passed only when run after 4am
    // ET, and failed the rest of the night by tripping the day-mismatch
    // branch (`null`) instead of the missing-`.state`-property branch this
    // test actually exercises (`undefined`).
    const legacyPayload = {
      date: voteDayFor(new Date(), DEFAULT_VOTE_DAY_TIMEZONE),
      byCity: {
        'Charlotte, NC': { remainingVotes: 1, maxVotes: 3, votedVenueIds: ['v1', 'v2'] },
      },
    };
    storage.set('crawl.mockVoteState.v1', JSON.stringify(legacyPayload));

    // The new reader looks for `.state`, which doesn't exist on the legacy
    // shape, so it resolves `undefined` rather than a `VoteState` object.
    const raw = await readPersistedVoteState();
    expect(raw).toBeUndefined();

    // getMockVoteState()'s `?? DEFAULT_VOTE_STATE` catches that `undefined`,
    // so callers get a clean, well-formed default instead of a crash or
    // `NaN`/`undefined` vote counts. Today's already-cast legacy votes are
    // lost on migration, which is an acceptable trade-off for a mock layer.
    const state = await getMockVoteState();
    expect(state).toEqual(DEFAULT_VOTE_STATE);

    // And the layer keeps working going forward: the next write overwrites
    // the legacy shape with the new one.
    await castMockVote('v3');
    expect((await getMockVoteState()).remainingVotes).toBe(2);
  });

  it('matches the server error-precedence when a cast is both a duplicate AND the budget is exhausted', async () => {
    // Server order (apps/api/src/services/vote.service.ts:33-40, castVote):
    // checks `remainingVotes <= 0` BEFORE checking for an existing vote, so a
    // double-violation throws NO_VOTES_REMAINING. castMockVote now checks in
    // the same order, so the mock and server agree on which code wins.
    await castMockVote('v1');
    await castMockVote('v2');
    await castMockVote('v3'); // budget now exhausted

    await expect(castMockVote('v1')).rejects.toMatchObject({ code: 'NO_VOTES_REMAINING' });
  });
});
