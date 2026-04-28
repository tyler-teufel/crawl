import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { Venue, FilterOption, VoteState } from '@/types/venue';
import { defaultFilters } from '@/data/filters';
import { useVenues } from '@/api/venues';
import { useVoteState, useCastVote, useRemoveVote } from '@/api/votes';
import { useCities, findNearestCity } from '@/api/cities';
import { useAuth } from '@/context/AuthContext';

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
  /** True while the venues query has no cached data yet for the current key. */
  isVenuesLoading: boolean;
  /** True if the venues query is currently in an error state. */
  isVenuesError: boolean;
  /** Manually retry the venues query. */
  refetchVenues: () => void;
}

const VenueContext = createContext<VenueContextValue | null>(null);

const DEFAULT_VOTE_STATE: VoteState = {
  remainingVotes: 3,
  maxVotes: 3,
  votedVenueIds: [],
};

const FALLBACK_CITY = 'Austin, TX';

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterOption[]>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(FALLBACK_CITY);

  // Seed `selectedCity` once from the nearest covered city to the user's
  // location. Skipped if the user has already chosen a city manually.
  const { userLocation } = useAuth();
  const { data: cities = [] } = useCities();
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (cities.length === 0) return;

    let next: string | null = null;
    if (userLocation) {
      const nearest = findNearestCity(cities, userLocation);
      if (nearest) next = nearest.displayName;
    }
    if (!next && !cities.some((c) => c.displayName === FALLBACK_CITY)) {
      next = cities[0].displayName;
    }
    if (next && next !== selectedCity) setSelectedCity(next);
    seededRef.current = true;
  }, [cities, userLocation, selectedCity]);

  const setSelectedCityManual = useCallback((city: string) => {
    seededRef.current = true;
    setSelectedCity(city);
  }, []);

  const activeFilterIds = useMemo(
    () => filters.filter((f) => f.enabled).map((f) => f.id),
    [filters]
  );

  // Server-side filtering happens inside `useVenues` (see venues.ts). The
  // queryKey includes city + sorted filters, so changes refetch automatically.
  const venuesQuery = useVenues(selectedCity, activeFilterIds);
  // Memoize the empty default so `venues` is stable across renders when the
  // query is still loading — otherwise downstream useMemo deps thrash.
  const venues = useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);
  const { data: voteState = DEFAULT_VOTE_STATE } = useVoteState(selectedCity);
  const castVoteMutation = useCastVote(selectedCity);
  const removeVoteMutation = useRemoveVote(selectedCity);

  // `isLoading` is only true on the *first* fetch with no cached data — once
  // a city has been seen, switching back uses cache while a refetch happens
  // in the background. Skeletons should only show in the no-data case.
  const isVenuesLoading = venuesQuery.isLoading;
  const isVenuesError = venuesQuery.isError;
  const refetchVenues = useCallback(() => {
    void venuesQuery.refetch();
  }, [venuesQuery]);

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

  // Search remains client-side over the already-filtered venue list — fast,
  // and keystrokes shouldn't round-trip to the server.
  const filteredVenues = useMemo(() => {
    if (!searchQuery) return venues;
    const q = searchQuery.toLowerCase();
    return venues.filter(
      (venue) => venue.name.toLowerCase().includes(q) || venue.primaryType.toLowerCase().includes(q)
    );
  }, [venues, searchQuery]);

  return (
    <VenueContext.Provider
      value={{
        venues,
        filters,
        voteState,
        searchQuery,
        selectedCity,
        setSearchQuery,
        setSelectedCity: setSelectedCityManual,
        toggleFilter,
        resetFilters,
        castVote,
        removeVote,
        filteredVenues,
        isVenuesLoading,
        isVenuesError,
        refetchVenues,
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
