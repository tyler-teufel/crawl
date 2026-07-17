import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VoteState } from '@/types/venue';
import { apiClient, castVote as castVoteApi } from './client';
import { venueKeys } from './venues';
import { readPersistedVoteState, writePersistedVoteState } from './voteStorage';
import { hasApi } from '@/lib/env';

const USE_REAL_API = hasApi;

export const voteKeys = {
  all: ['votes'] as const,
  // City is part of the query key (for cache scoping / the real API's
  // per-city fetch), but the underlying vote budget is GLOBAL per user/day —
  // see voteStorage.ts and apps/api/src/services/vote.service.ts. `states()`
  // is the shared prefix of every per-city `state(city)` key, used to update
  // ALL cached vote-state entries at once after a cast/removal so no other
  // city's cached entry is left showing a stale count.
  states: () => ['votes', 'state'] as const,
  state: (city: string) => ['votes', 'state', city] as const,
};

export const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

// Mirrors the server's VoteError (apps/api/src/services/vote.service.ts) so
// mock-mode consumers of useCastVote hit the same onError code path as the
// real API.
export class VoteError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'VoteError';
  }
}

// Mock-mode implementations, exported for tests. State is persisted per date
// (see voteStorage.ts), GLOBAL across cities — matching the server's 3
// votes/day/user budget, which has no city dimension — so refetches return
// accumulated votes instead of resetting to the default. The fallback only
// applies when no entry exists yet for today (first use or day rollover).
export async function getMockVoteState(): Promise<VoteState> {
  return (await readPersistedVoteState()) ?? DEFAULT_VOTE_STATE;
}

export async function castMockVote(venueId: string): Promise<VoteState> {
  const current = await getMockVoteState();
  // Order matches the server's VoteService.castVote
  // (apps/api/src/services/vote.service.ts:33-40): remaining-votes check
  // first, so a duplicate cast after the budget is exhausted throws
  // NO_VOTES_REMAINING, not ALREADY_VOTED.
  if (current.remainingVotes <= 0) {
    throw new VoteError('NO_VOTES_REMAINING', 'You have used all your votes for today.');
  }
  if (current.votedVenueIds.includes(venueId)) {
    throw new VoteError('ALREADY_VOTED', 'You have already voted for this venue today.');
  }
  const next: VoteState = {
    ...current,
    remainingVotes: current.remainingVotes - 1,
    votedVenueIds: [...current.votedVenueIds, venueId],
  };
  await writePersistedVoteState(next);
  return next;
}

export async function removeMockVote(venueId: string): Promise<VoteState> {
  const current = await getMockVoteState();
  if (!current.votedVenueIds.includes(venueId)) return current;
  const next: VoteState = {
    ...current,
    remainingVotes: current.remainingVotes + 1,
    votedVenueIds: current.votedVenueIds.filter((id) => id !== venueId),
  };
  await writePersistedVoteState(next);
  return next;
}

export function useVoteState(city: string) {
  return useQuery<VoteState>({
    queryKey: voteKeys.state(city),
    queryFn: async () => {
      if (!USE_REAL_API) return getMockVoteState();
      return apiClient<VoteState>(`/votes?city=${encodeURIComponent(city)}`);
    },
    staleTime: 5_000,
  });
}

export function useCastVote(city: string) {
  const queryClient = useQueryClient();

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      if (!USE_REAL_API) return castMockVote(venueId);
      return castVoteApi(venueId) as Promise<VoteState>;
    },
    onMutate: async (venueId) => {
      // Optimistically increment voteCount on the venue detail
      await queryClient.cancelQueries({ queryKey: venueKeys.detail(venueId) });
      const previous = queryClient.getQueryData(venueKeys.detail(venueId));
      queryClient.setQueryData(venueKeys.detail(venueId), (old: any) =>
        old ? { ...old, voteCount: (old.voteCount ?? 0) + 1 } : old
      );
      return { previous };
    },
    onError: (_err, venueId, context: any) => {
      queryClient.setQueryData(venueKeys.detail(venueId), context?.previous);
    },
    onSuccess: (newState) => {
      // The vote budget is GLOBAL, so every cached per-city vote-state entry
      // (not just this `city`'s) must reflect the new count — otherwise a
      // previously-fetched city's cache stays stale until its staleTime lapses.
      queryClient.setQueriesData({ queryKey: voteKeys.states() }, newState);
    },
    onSettled: (_data, _err, venueId) => {
      queryClient.invalidateQueries({ queryKey: venueKeys.detail(venueId) });
    },
  });
}

export function useRemoveVote(city: string) {
  const queryClient = useQueryClient();

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      if (!USE_REAL_API) return removeMockVote(venueId);
      return apiClient<VoteState>(`/votes/${venueId}`, { method: 'DELETE' });
    },
    onSuccess: (newState) => {
      // Same rationale as useCastVote above: update every cached city entry.
      queryClient.setQueriesData({ queryKey: voteKeys.states() }, newState);
    },
  });
}
