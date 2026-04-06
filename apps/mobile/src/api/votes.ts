import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VoteState } from '@/types/venue';

export const voteKeys = {
  all: ['votes'] as const,
  state: ['votes', 'state'] as const,
};

const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

export function useVoteState() {
  return useQuery<VoteState>({
    queryKey: voteKeys.state,
    queryFn: async () => DEFAULT_VOTE_STATE, // Replace with apiClient call in Phase B
    staleTime: 5_000,
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      // Mock: operate on cache directly. Replace with apiClient POST in Phase C.
      const current = queryClient.getQueryData<VoteState>(voteKeys.state) ?? DEFAULT_VOTE_STATE;
      if (current.remainingVotes <= 0 || current.votedVenueIds.includes(venueId)) return current;
      return {
        ...current,
        remainingVotes: current.remainingVotes - 1,
        votedVenueIds: [...current.votedVenueIds, venueId],
      };
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(voteKeys.state, newState);
    },
  });
}

export function useRemoveVote() {
  const queryClient = useQueryClient();

  return useMutation<VoteState, Error, string>({
    mutationFn: async (venueId: string) => {
      // Mock: operate on cache directly. Replace with apiClient DELETE in Phase C.
      const current = queryClient.getQueryData<VoteState>(voteKeys.state) ?? DEFAULT_VOTE_STATE;
      if (!current.votedVenueIds.includes(venueId)) return current;
      return {
        ...current,
        remainingVotes: current.remainingVotes + 1,
        votedVenueIds: current.votedVenueIds.filter((id) => id !== venueId),
      };
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(voteKeys.state, newState);
    },
  });
}
