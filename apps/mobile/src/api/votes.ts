import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VoteState } from '@/types/venue';
import { apiClient, castVote as castVoteApi } from './client';
import { venueKeys } from './venues';

const USE_REAL_API = !!process.env.EXPO_PUBLIC_API_URL;

export const voteKeys = {
  all: ['votes'] as const,
  // City is part of the key so switching cities invalidates the per-day
  // vote state automatically (a user's daily allowance is scoped per city).
  state: (city: string) => ['votes', 'state', city] as const,
};

const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

export function useVoteState(city: string) {
  return useQuery<VoteState>({
    queryKey: voteKeys.state(city),
    queryFn: async () => {
      if (!USE_REAL_API) return DEFAULT_VOTE_STATE;
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
      if (!USE_REAL_API) {
        const current = queryClient.getQueryData<VoteState>(stateKey) ?? DEFAULT_VOTE_STATE;
        if (current.remainingVotes <= 0 || current.votedVenueIds.includes(venueId)) return current;
        return {
          ...current,
          remainingVotes: current.remainingVotes - 1,
          votedVenueIds: [...current.votedVenueIds, venueId],
        };
      }
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
      if (!USE_REAL_API) {
        const current = queryClient.getQueryData<VoteState>(stateKey) ?? DEFAULT_VOTE_STATE;
        if (!current.votedVenueIds.includes(venueId)) return current;
        return {
          ...current,
          remainingVotes: current.remainingVotes + 1,
          votedVenueIds: current.votedVenueIds.filter((id: string) => id !== venueId),
        };
      }
      return apiClient<VoteState>(`/votes/${venueId}`, { method: 'DELETE' });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(stateKey, newState);
    },
  });
}
