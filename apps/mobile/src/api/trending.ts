import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { hasApi } from '@/lib/env';

// Mirrors the fallback branching in venues.ts.
const USE_REAL_API = hasApi;

const MOCK_TRENDING_LIMIT = 10;

export const trendingKeys = {
  all: ['trending'] as const,
  list: (city: string) => ['trending', 'list', city] as const,
};

export function getMockTrending(city: string): Venue[] {
  return [...(mockVenuesByCity[city] ?? mockVenues)]
    .sort((a, b) => b.hotspotScore - a.hotspotScore)
    .slice(0, MOCK_TRENDING_LIMIT);
}

export function useTrending(city: string) {
  return useQuery<Venue[]>({
    queryKey: trendingKeys.list(city),
    queryFn: async () => {
      if (USE_REAL_API) {
        return apiClient<Venue[]>(`/trending/${encodeURIComponent(city)}`);
      }
      return getMockTrending(city);
    },
    staleTime: 30_000,
  });
}
