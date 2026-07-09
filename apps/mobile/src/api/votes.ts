import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VoteState } from '@/types/venue';
import { apiClient, castVote as castVoteApi } from './client';
import { venueKeys } from './venues';
import { readPersistedVoteState, writePersistedVoteState } from './voteStorage';
import { hasApi } from '@/lib/env';

const USE_REAL_API = hasApi;

export const voteKeys = {
  all: ['votes'] as const,
  // City is part of the key so switching cities invalidates the per-day
  // vote state automatically (a user's daily allowance is scoped per city).
  state: (city: string) => ['votes', 'state', city] as const,
};

export const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

// Mock-mode implementations, exported for tests. State is persisted per
// date + city (see voteStorage.ts) so refetches return accumulated votes
// instead of resetting to the default — the fallback only applies when no
// entry exists yet for today (first use or day rollover).
export async function getMockVoteState(city: string): Promise<VoteState> {
  return (await readPersistedVoteState(city)) ?? DEFAULT_VOTE_STATE;
}

export async function castMockVote(city: string, venueId: string): Promise<VoteState> {
  const current = await getMockVoteState(city);
  if (current.remainingVotes <= 0 || current.votedVenueIds.includes(venueId)) return current;
  const next: VoteState = {
    ...current,
    remainingVotes: current.remainingVotes - 1,
    votedVenueIds: [...current.votedVenueIds, venueId],
  };
  await writePersistedVoteState(city, next);
  return next;
}

export async function removeMockVote(city: string, venueId: string): Promise<VoteState> {
  const current = await getMockVoteState(city);
  if (!current.votedVenueIds.includes(venueId)) return current;
  const next: VoteState = {
    ...current,
    remainingVotes: current.remainingVotes + 1,
    votedVenueIds: current.votedVenueIds.filter((id) => id !== venueId),
  };
  await writePersistedVoteState(city, next);
  return next;
}

export function useVoteState(city: string) {
  return useQuery<VoteState>({
    queryKey: voteKeys.state(city),
    queryFn: async () => {
      if (!USE_REAL_API) return getMockVoteState(city);
      return apiClient<VoteState>(`/votes?city=${encodeURIComponent(city)}`);
    },
    staleTime: 5_000,
  });
}

export function useCastVote(city: string) {
  const queryClient = useQueryClient();
  const stateKey = voteKeys.state(city);

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      if (!USE_REAL_API) return castMockVote(city, venueId);
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
      queryClient.setQueryData(stateKey, newState);
    },
    onSettled: (_data, _err, venueId) => {
      queryClient.invalidateQueries({ queryKey: venueKeys.detail(venueId) });
    },
  });
}

export function useRemoveVote(city: string) {
  const queryClient = useQueryClient();
  const stateKey = voteKeys.state(city);

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      if (!USE_REAL_API) return removeMockVote(city, venueId);
      return apiClient<VoteState>(`/votes/${venueId}`, { method: 'DELETE' });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(stateKey, newState);
    },
  });
}
