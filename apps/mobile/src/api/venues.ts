import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues } from '@/data/venues';
import { apiClient } from './client';

const USE_REAL_API = !!process.env.EXPO_PUBLIC_API_URL;

export const venueKeys = {
  all: ['venues'] as const,
  list: (city: string, filters: string[]) => ['venues', 'list', city, filters] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

export function useVenues(city: string, filters: string[]) {
  return useQuery<Venue[]>({
    queryKey: venueKeys.list(city, filters),
    queryFn: async () => {
      if (!USE_REAL_API) return mockVenues;
      const res = await apiClient<{ data: Venue[] }>(
        `/venues?city=${encodeURIComponent(city)}${filters.length ? `&filters=${filters.join(',')}` : ''}`,
      );
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useVenue(id: string) {
  return useQuery<Venue | undefined>({
    queryKey: venueKeys.detail(id),
    queryFn: async () => {
      if (!USE_REAL_API) return mockVenues.find((v) => v.id === id);
      return apiClient<Venue>(`/venues/${id}`);
    },
    staleTime: 30_000,
    enabled: !!id,
  });
}
