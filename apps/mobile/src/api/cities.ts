import { useQuery, type QueryClient } from '@tanstack/react-query';
import { mockCities } from '@/data/cities';
import { supabase } from '@/lib/supabase';
import { hasSupabase } from '@/lib/env';

export interface City {
  id: string;
  slug: string;
  name: string;
  state: string;
  centerLat: number;
  centerLng: number;
  /** Radius of the city's venue coverage area, in meters. Used to size the map camera (#166). */
  radiusMeters: number;
  /** "Name, State" — the format venues.city is denormalized in. */
  displayName: string;
}

interface CityRow {
  id: string;
  slug: string;
  name: string;
  state: string;
  center_lat: string | number;
  center_lng: string | number;
  radius_meters: string | number;
}

export const cityKeys = {
  all: ['cities'] as const,
  list: ['cities', 'list'] as const,
};

// Only columns the mobile client consumes today are selected — `public.cities`
// also has `timezone`, not modeled here or in `City`.
const CITY_COLUMNS = 'id, slug, name, state, center_lat, center_lng, radius_meters';

export function rowToCity(row: CityRow): City {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    radiusMeters: Number(row.radius_meters),
    displayName: `${row.name}, ${row.state}`,
  };
}

// There is no cities API endpoint yet, so this only branches on
// Supabase-direct reads (RLS permits public read) vs. bundled mock data.
async function fetchCities(): Promise<City[]> {
  if (hasSupabase) {
    const { data, error } = await supabase.from('cities').select(CITY_COLUMNS).order('name');
    if (error) throw error;
    return ((data ?? []) as CityRow[]).map(rowToCity);
  }
  return mockCities;
}

export const citiesQueryOptions = {
  queryKey: cityKeys.list,
  queryFn: fetchCities,
  staleTime: 60 * 60 * 1000, // 1h — cities rarely change
};

export function useCities() {
  return useQuery<City[]>(citiesQueryOptions);
}

/**
 * Resolve a `City.displayName` to the `cities.id` that `venues.city_id`
 * references, reusing (and warming) the same cache `useCities` reads.
 *
 * Venue queries filter on `city_id` rather than the denormalized `venues.city`
 * text column because the two never agreed: the ingest job writes the bare
 * city name it was invoked with ("Charlotte") while `displayName` appends the
 * state ("Charlotte, NC"), so equality on that column matched zero rows for
 * every city (#149).
 *
 * Throws when no city matches. That surfaces as the caller's error state —
 * deliberately louder than returning nothing, which is indistinguishable from
 * "this city has no venues" and is what made the original bug read as empty
 * data rather than a broken query.
 */
export async function resolveCityId(client: QueryClient, displayName: string): Promise<string> {
  const cities = await client.fetchQuery(citiesQueryOptions);
  const match = cities.find((c) => c.displayName === displayName);
  if (!match) {
    throw new Error(`No city row matches "${displayName}" — cannot resolve its venues.`);
  }
  return match.id;
}

const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Pick the city closest to `location`, but only if it's within
 * `maxMiles` (default 50). Beyond that distance the user is far enough
 * from any covered city that snapping the map to it would be misleading.
 */
export function findNearestCity(
  cities: City[],
  location: { latitude: number; longitude: number },
  maxMiles = 50
): City | null {
  let best: { city: City; miles: number } | null = null;
  for (const city of cities) {
    const miles = haversineMiles(location, {
      latitude: city.centerLat,
      longitude: city.centerLng,
    });
    if (!best || miles < best.miles) best = { city, miles };
  }
  if (!best || best.miles > maxMiles) return null;
  return best.city;
}
