import React, { createContext, useContext, useState, useCallback } from 'react';
import { Venue, FilterOption, VoteState } from '@/types/venue';
import { mockVenues } from '@/data/venues';
import { defaultFilters } from '@/data/filters';

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

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterOption[]>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Austin, TX');
  const [voteState, setVoteState] = useState<VoteState>({
    remainingVotes: 3,
    maxVotes: 3,
    votedVenueIds: [],
  });

  const toggleFilter = useCallback((id: string) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const castVote = useCallback((venueId: string) => {
    setVoteState((prev) => {
      if (prev.remainingVotes <= 0 || prev.votedVenueIds.includes(venueId)) return prev;
      return {
        ...prev,
        remainingVotes: prev.remainingVotes - 1,
        votedVenueIds: [...prev.votedVenueIds, venueId],
      };
    });
  }, []);

  const removeVote = useCallback((venueId: string) => {
    setVoteState((prev) => {
      if (!prev.votedVenueIds.includes(venueId)) return prev;
      return {
        ...prev,
        remainingVotes: prev.remainingVotes + 1,
        votedVenueIds: prev.votedVenueIds.filter((id) => id !== venueId),
      };
    });
  }, []);

  const activeFilterIds = filters.filter((f) => f.enabled).map((f) => f.id);

  const filteredVenues = mockVenues.filter((venue) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!venue.name.toLowerCase().includes(q) && !venue.type.toLowerCase().includes(q))
        return false;
    }
    if (activeFilterIds.length === 0) return true;
    // Simple filter matching
    if (activeFilterIds.includes('trending') && !venue.isTrending) return false;
    if (activeFilterIds.includes('open-now') && !venue.isOpen) return false;
    return true;
  });

  return (
    <VenueContext.Provider
      value={{
        venues: mockVenues,
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
