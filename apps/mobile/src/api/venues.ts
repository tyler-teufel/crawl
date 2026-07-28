import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { queryClient } from './query-client';
import { resolveCityId } from './cities';
import { VENUE_COLUMNS, rowToVenue, rowsToVenues, type VenueRow } from './venueRow';
import { supabase } from '@/lib/supabase';
import { dataSource } from '@/lib/env';
import { filterVenues } from '@/lib/filterVenues';

// Read tier is resolved once in @/lib/env: Railway API (EXPO_PUBLIC_API_URL) →
// Supabase-direct (EXPO_PUBLIC_SUPABASE_URL/KEY, RLS permits public read) →
// bundled mock data. Supabase reads apply filters client-side via filterVenues,
// same as mock mode, so filter behavior is identical across both fallback tiers.

export const venueKeys = {
  all: ['venues'] as const,
  // Filters are sorted before keying so ['a','b'] and ['b','a'] share a cache entry.
  list: (city: string, filters: string[]) => ['venues', 'list', city, [...filters].sort()] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

export function useVenues(city: string, filters: string[]) {
  return useQuery<Venue[]>({
    // Keyed on the display name, not the resolved id: the two are 1:1 and the
    // display name is what the caller (and the vote cache) already holds.
    queryKey: venueKeys.list(city, filters),
    queryFn: async () => {
      if (dataSource === 'api') {
        const res = await apiClient<{ data: Venue[] }>(
          `/venues?city=${encodeURIComponent(city)}${filters.length ? `&filters=${filters.join(',')}` : ''}`
        );
        return res.data;
      }
      if (dataSource === 'supabase') {
        const cityId = await resolveCityId(queryClient, city);
        const { data, error } = await supabase
          .from('venues')
          .select(VENUE_COLUMNS)
          .eq('is_active', true)
          .eq('city_id', cityId)
          // Name breaks the tie: every venue currently scores 0 (nothing
          // recalculates hotspot_score outside the unpaid Fastify API), and
          // without a tiebreak Postgres is free to return an all-ties set in a
          // different order on each refetch, visibly reshuffling the list.
          .order('hotspot_score', { ascending: false })
          .order('name');
        if (error) throw error;
        return filterVenues(rowsToVenues((data ?? []) as VenueRow[]), filters);
      }
      return filterVenues(mockVenuesByCity[city] ?? mockVenues, filters);
    },
    staleTime: 30_000,
  });
}

async function fetchVenueDetail(id: string): Promise<Venue | undefined> {
  if (dataSource === 'api') {
    return apiClient<Venue>(`/venues/${id}`);
  }
  if (dataSource === 'supabase') {
    const { data, error } = await supabase
      .from('venues')
      .select(VENUE_COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data ? (rowToVenue(data as VenueRow) ?? undefined) : undefined;
  }
  return mockVenues.find((v) => v.id === id);
}

export function useVenue(id: string) {
  return useQuery<Venue | undefined>({
    queryKey: venueKeys.detail(id),
    queryFn: () => fetchVenueDetail(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

/**
 * Same query key + fetcher as `useVenue(id)`, exposed as plain options so
 * callers needing a variable-length list of id lookups (e.g. the Profile
 * screen's voting history) can pass them to `useQueries` instead of calling
 * a hook in a loop.
 */
export function venueDetailQueryOptions(id: string) {
  return {
    queryKey: venueKeys.detail(id),
    queryFn: () => fetchVenueDetail(id),
    staleTime: 30_000,
  };
}
