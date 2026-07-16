import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { getMockVoteState, castMockVote, voteKeys } from '@/api/votes';

// #62 flattened the mock vote BUDGET to be global-per-day, but
// `voteKeys.state(city)` (apps/mobile/src/api/votes.ts) still keys the React
// Query cache per city. useCastVote/useRemoveVote's onSuccess now writes the
// new state into every cache entry under the shared `voteKeys.states()`
// prefix (not just the city that was voted in), so the cache can't go stale
// for a previously-fetched city. These tests exercise that directly through
// QueryClient, mirroring exactly what useVoteState's queryFn and
// useCastVote's onSuccess do, without needing to render the React hooks.

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

describe('vote cache key vs. global mock budget', () => {
  it('a never-before-fetched city query reflects the shared global count, not a fresh per-city allotment (no regression to per-city keying)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } });

    // Cast 2 votes "in" city A (as useCastVote('A') would via its
    // mutationFn), exhausting most of the global budget.
    await castMockVote('v1');
    await castMockVote('v2');

    // City B has never been queried before, so its query key has no cache
    // entry and useVoteState('B')'s queryFn must run for the first time.
    const cityBState = await qc.fetchQuery({
      queryKey: voteKeys.state('B'),
      queryFn: getMockVoteState,
    });

    // If castMockVote/getMockVoteState ever regressed to per-city storage,
    // this would come back as a fresh { remainingVotes: 3, votedVenueIds: [] }
    // instead of reflecting the 2 votes already spent globally.
    expect(cityBState.remainingVotes).toBe(1);
    expect(cityBState.votedVenueIds).toEqual(['v1', 'v2']);
  });

  it("a cached vote count for a city other than the one just voted in is updated, because useCastVote's onSuccess writes to every voteKeys.states() cache entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } });

    // Simulate useVoteState('A') and useVoteState('B') both having been
    // viewed already (e.g. user browsed city A, then switched to city B),
    // populating a cache entry for each.
    await qc.fetchQuery({ queryKey: voteKeys.state('A'), queryFn: getMockVoteState });
    await qc.fetchQuery({ queryKey: voteKeys.state('B'), queryFn: getMockVoteState });

    // Simulate useCastVote('A').mutate(...): mutationFn runs, then onSuccess
    // does `queryClient.setQueriesData({ queryKey: voteKeys.states() }, newState)`
    // — every per-city cache key sharing the `voteKeys.states()` prefix is
    // updated, not just city A's.
    const newState = await castMockVote('v1');
    qc.setQueriesData({ queryKey: voteKeys.states() }, newState);

    // Since the budget is GLOBAL, city B's cached vote state now reflects
    // the reduced count too.
    const cachedB = qc.getQueryData(voteKeys.state('B'));
    expect(cachedB).toEqual(newState);
  });
});
