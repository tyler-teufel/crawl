import { useQuery } from '@tanstack/react-query';
import { Venue } from '@/types/venue';
import { mockVenues } from '@/data/venues';
import { supabase } from '@/lib/supabase';
import { apiClient } from './client';

const USE_REAL_API = !!process.env.EXPO_PUBLIC_API_URL;
const USE_SUPABASE =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const venueKeys = {
  all: ['venues'] as const,
  list: (city: string, filters: string[]) => ['venues', 'list', city, filters] as const,
  detail: (id: string) => ['venues', 'detail', id] as const,
};

// Shape of a row returned by `select('*')` against the `venues` table.
// Supabase preserves Postgres column casing (snake_case) and serializes
// `numeric` columns as strings, so we normalize both here.
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
          .select(
            'id, name, primary_type, address, latitude, longitude, hotspot_score, vote_count, is_open, is_trending, highlights, price_level, hours, description, image_url'
          )
          .eq('is_active', true);
        if (error) throw error;
        return ((data ?? []) as VenueRow[])
          .map(rowToVenue)
          .filter((v): v is Venue => v !== null);
      }
      return mockVenues;
    },
    staleTime: 30_000,
  });
}

export function useVenue(id: string) {
  return useQuery<Venue | undefined>({
    queryKey: venueKeys.detail(id),
    queryFn: async () => {
      if (USE_REAL_API) {
        return apiClient<Venue>(`/venues/${id}`);
      }
      if (USE_SUPABASE) {
        const { data, error } = await supabase
          .from('venues')
          .select(
            'id, name, primary_type, address, latitude, longitude, hotspot_score, vote_count, is_open, is_trending, highlights, price_level, hours, description, image_url'
          )
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data ? (rowToVenue(data as VenueRow) ?? undefined) : undefined;
      }
      return mockVenues.find((v) => v.id === id);
    },
    staleTime: 30_000,
    enabled: !!id,
  });
}
