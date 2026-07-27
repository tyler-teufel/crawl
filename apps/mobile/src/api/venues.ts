import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues, mockVenuesByCity } from '@/data/venues';
import { apiClient } from './client';
import { supabase } from '@/lib/supabase';
import { hasApi, hasSupabase } from '@/lib/env';
import { filterVenues } from '@/lib/filterVenues';

// Read priority: Railway API (EXPO_PUBLIC_API_URL) → Supabase-direct
// (EXPO_PUBLIC_SUPABASE_URL/KEY, RLS permits public read) → bundled mock data.
// Supabase reads apply filters client-side via filterVenues, same as mock
// mode, so filter behavior is identical across both fallback tiers.
const USE_REAL_API = hasApi;
const USE_SUPABASE = hasSupabase;

export const venueKeys = {
  all: ['venues'] as const,
  // Filters are sorted before keying so ['a','b'] and ['b','a'] share a cache entry.
  list: (city: string, filters: string[]) => ['venues', 'list', city, [...filters].sort()] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

// Shape of a row returned by `select(VENUE_COLUMNS)` against `public.venues`.
// Supabase preserves Postgres snake_case column names and serializes
// `numeric` columns as strings. Only columns the mobile client actually
// consumes are selected — `public.venues` has additional columns
// (city_id, google_place_id, types[], rating, total_ratings, phone, website)
// not modeled here or in the shared Venue type.
interface VenueRow {
  id: string;
  name: string;
  primary_type: string;
  address: string;
  latitude: string | number;
  longitude: string | number;
  hotspot_score: number;
  vote_count: number;
  is_open: boolean;
  is_trending: boolean;
  highlights: string[] | null;
  price_level: number | null;
  hours: string | null;
  description: string | null;
  image_url: string | null;
}

const VENUE_COLUMNS =
  'id, name, primary_type, address, latitude, longitude, hotspot_score, vote_count, is_open, is_trending, highlights, price_level, hours, description, image_url';

function rowToVenue(row: VenueRow): Venue | null {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (__DEV__) {
      console.warn(`[useVenues] Venue ${row.id} (${row.name}) has invalid coordinates`, {
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    primaryType: row.primary_type,
    address: row.address,
    distance: '',
    hotspotScore: row.hotspot_score,
    voteCount: row.vote_count,
    isOpen: row.is_open,
    isTrending: row.is_trending,
    highlights: row.highlights ?? [],
    latitude: lat,
    longitude: lng,
    imageUrl: row.image_url ?? undefined,
    priceLevel: row.price_level,
    hours: row.hours ?? '',
    description: row.description ?? '',
  };
}

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
      if (USE_SUPABASE) {
        const { data, error } = await supabase
          .from('venues')
          .select(VENUE_COLUMNS)
          .eq('is_active', true)
          .eq('city', city)
          .order('hotspot_score', { ascending: false });
        if (error) throw error;
        const venues = ((data ?? []) as VenueRow[])
          .map(rowToVenue)
          .filter((v): v is Venue => v !== null);
        return filterVenues(venues, filters);
      }
      return filterVenues(mockVenuesByCity[city] ?? mockVenues, filters);
    },
    staleTime: 30_000,
  });
}

async function fetchVenueDetail(id: string): Promise<Venue | undefined> {
  if (USE_REAL_API) {
    return apiClient<Venue>(`/venues/${id}`);
  }
  if (USE_SUPABASE) {
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
