import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { hasApi } from '@/lib/env';

// Same fallback shape as src/api/venues.ts: prefer the Railway API when it's
// configured, otherwise fall back to the bundled mock set. A `hasSupabase`
// tier can slot in between the two branches below (see #78) without
// reshaping this hook.
const USE_REAL_API = hasApi;

const MOCK_TRENDING_LIMIT = 10;

export const trendingKeys = {
  all: ['trending'] as const,
  list: (city: string) => ['trending', 'list', city] as const,
};

export function useTrending(city: string) {
  return useQuery<Venue[]>({
    queryKey: trendingKeys.list(city),
    queryFn: async () => {
      if (USE_REAL_API) {
        return apiClient<Venue[]>(`/trending/${encodeURIComponent(city)}`);
      }
      return [...(mockVenuesByCity[city] ?? mockVenues)]
        .sort((a, b) => b.hotspotScore - a.hotspotScore)
        .slice(0, MOCK_TRENDING_LIMIT);
    },
    staleTime: 30_000,
  });
}
