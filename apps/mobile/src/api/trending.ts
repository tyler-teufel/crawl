import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { queryClient } from './query-client';
import { resolveCityId } from './cities';
import { VENUE_COLUMNS, rowsToVenues, type VenueRow } from './venueRow';
import { supabase } from '@/lib/supabase';
import { dataSource } from '@/lib/env';

const TRENDING_LIMIT = 10;

export const trendingKeys = {
  all: ['trending'] as const,
  list: (city: string) => ['trending', 'list', city] as const,
};

export function getMockTrending(city: string): Venue[] {
  return [...(mockVenuesByCity[city] ?? mockVenues)]
    .sort((a, b) => b.hotspotScore - a.hotspotScore)
    .slice(0, TRENDING_LIMIT);
}

export function useTrending(city: string) {
  return useQuery<Venue[]>({
    queryKey: trendingKeys.list(city),
    queryFn: async () => {
      if (dataSource === 'api') {
        return apiClient<Venue[]>(`/trending/${encodeURIComponent(city)}`);
      }
      if (dataSource === 'supabase') {
        // Ranking is `hotspot_score` descending — the same ordering the venue
        // list uses, capped at the leaderboard length. There is no separate
        // trending table; "trending" is the top slice of the same rows.
        const cityId = await resolveCityId(queryClient, city);
        const { data, error } = await supabase
          .from('venues')
          .select(VENUE_COLUMNS)
          .eq('is_active', true)
          .eq('city_id', cityId)
          // Name breaks the tie so the leaderboard is stable across refetches
          // while every venue still scores 0 — without it, `limit` would return
          // a different arbitrary 10 each time.
          .order('hotspot_score', { ascending: false })
          .order('name')
          .limit(TRENDING_LIMIT);
        if (error) throw error;
        return rowsToVenues((data ?? []) as VenueRow[]);
      }
      return getMockTrending(city);
    },
    staleTime: 30_000,
  });
}
