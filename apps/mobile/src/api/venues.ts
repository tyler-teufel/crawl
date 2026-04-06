import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues } from '@/data/venues';

export const venueKeys = {
  all: ['venues'] as const,
  list: (city: string, filters: string[]) => ['venues', 'list', city, filters] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

export function useVenues(city: string, filters: string[]) {
  return useQuery<Venue[]>({
    queryKey: venueKeys.list(city, filters),
    queryFn: async () => mockVenues, // Replace with apiClient call in Phase B
    staleTime: 30_000,
  });
}

export function useVenue(id: string) {
  return useQuery<Venue | undefined>({
    queryKey: venueKeys.detail(id),
    queryFn: async () => mockVenues.find((v) => v.id === id), // Replace with apiClient call in Phase B
    staleTime: 30_000,
    enabled: !!id,
  });
}
