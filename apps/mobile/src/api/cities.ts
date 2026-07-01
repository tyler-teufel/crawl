import { useQuery } from '@tanstack/react-query';
import { mockCities } from '@/data/cities';

export interface City {
  id: string;
  slug: string;
  name: string;
  state: string;
  centerLat: number;
  centerLng: number;
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
}

export const cityKeys = {
  all: ['cities'] as const,
  list: ['cities', 'list'] as const,
};

export function rowToCity(row: CityRow): City {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    displayName: `${row.name}, ${row.state}`,
  };
}

export function useCities() {
  return useQuery<City[]>({
    queryKey: cityKeys.list,
    // Cities come from the bundled mock set. There is no cities API endpoint
    // yet, and the client does not read Supabase directly (auth-only). When a
    // real source exists, swap this queryFn to fetch + `rowToCity`.
    queryFn: () => mockCities,
    staleTime: 60 * 60 * 1000, // 1h — cities rarely change
  });
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
