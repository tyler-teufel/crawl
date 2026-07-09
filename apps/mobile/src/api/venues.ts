import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { hasApi } from '@/lib/env';
import { filterVenues } from '@/lib/filterVenues';

// Venue data comes from the Railway API when configured, otherwise the bundled
// mock set. The client does NOT read Supabase venue tables directly — Supabase
// is used only for auth (see src/lib/supabase.ts). When the API is wired up,
// setting EXPO_PUBLIC_API_URL flips every hook here to live data.
const USE_REAL_API = hasApi;

export const venueKeys = {
  all: ['venues'] as const,
  // Filters are sorted before keying so ['a','b'] and ['b','a'] share a cache entry.
  list: (city: string, filters: string[]) => ['venues', 'list', city, [...filters].sort()] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

export function useVenues(city: string, filters: string[]) {
  return useQuery<Venue[]>({
    queryKey: venueKeys.list(city, filters),
    queryFn: async () => {
      if (USE_REAL_API) {
        const res = await apiClient<{ data: Venue[] }>(
          `/venues?city=${encodeURIComponent(city)}${filters.length ? `&filters=${filters.join(',')}` : ''}`
        );
        return res.data;
      }
      return filterVenues(mockVenuesByCity[city] ?? mockVenues, filters);
    },
    staleTime: 30_000,
  });
}

export function useVenue(id: string) {
  return useQuery<Venue | undefined>({
    queryKey: venueKeys.detail(id),
    queryFn: () => {
      if (USE_REAL_API) {
        return apiClient<Venue>(`/venues/${id}`);
      }
      return mockVenues.find((v) => v.id === id);
    },
    staleTime: 30_000,
    enabled: !!id,
  });
}
