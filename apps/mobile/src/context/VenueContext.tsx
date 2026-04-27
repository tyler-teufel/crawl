import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Venue, FilterOption, VoteState } from '@/types/venue';
import { defaultFilters } from '@/data/filters';
import { useVenues } from '@/api/venues';
import { useVoteState, useCastVote, useRemoveVote } from '@/api/votes';

interface VenueContextValue {
  venues: Venue[];
  filters: FilterOption[];
  voteState: VoteState;
  searchQuery: string;
  selectedCity: string;
  setSearchQuery: (q: string) => void;
  setSelectedCity: (city: string) => void;
  toggleFilter: (id: string) => void;
  resetFilters: () => void;
  castVote: (venueId: string) => void;
  removeVote: (venueId: string) => void;
  filteredVenues: Venue[];
}

const VenueContext = createContext<VenueContextValue | null>(null);

const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterOption[]>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  // TODO(phase-b-agent-2): seed initial city based on userLocation from
  // AuthContext (find nearest city in DB). For now we hardcode Austin, TX.
  const [selectedCity, setSelectedCity] = useState('Austin, TX');

  const activeFilterIds = useMemo(
    () => filters.filter((f) => f.enabled).map((f) => f.id),
    [filters]
  );

  // Data from TanStack Query
  const { data: venues = [] } = useVenues(selectedCity, activeFilterIds);
  const { data: voteState = DEFAULT_VOTE_STATE } = useVoteState();
  const castVoteMutation = useCastVote();
  const removeVoteMutation = useRemoveVote();

  const toggleFilter = useCallback((id: string) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const castVote = useCallback(
    (venueId: string) => {
      castVoteMutation.mutate(venueId);
    },
    [castVoteMutation]
  );

  const removeVote = useCallback(
    (venueId: string) => {
      removeVoteMutation.mutate(venueId);
    },
    [removeVoteMutation]
  );

  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!venue.name.toLowerCase().includes(q) && !venue.primaryType.toLowerCase().includes(q))
          return false;
      }
      if (activeFilterIds.length === 0) return true;
      if (activeFilterIds.includes('trending') && !venue.isTrending) return false;
      if (activeFilterIds.includes('open-now') && !venue.isOpen) return false;
      return true;
    });
  }, [venues, searchQuery, activeFilterIds]);

  return (
    <VenueContext.Provider
      value={{
        venues,
        filters,
        voteState,
        searchQuery,
        selectedCity,
        setSearchQuery,
        setSelectedCity,
        toggleFilter,
        resetFilters,
        castVote,
        removeVote,
        filteredVenues,
      }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenueContext() {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error('useVenueContext must be used within VenueProvider');
  return ctx;
}
