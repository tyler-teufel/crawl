import { Venue } from '@/types/venue';
import { formatVenueType } from '@/lib/formatVenueType';

// The `public.venues` read shape shared by every Supabase-direct venue query
// (list, trending, detail). It lives here rather than in venues.ts so the
// trending hook cannot drift into its own column list or row mapping — that
// drift is exactly what left Global Rankings on mock data (#150).

// Shape of a row returned by `select(VENUE_COLUMNS)` against `public.venues`.
// Supabase preserves Postgres snake_case column names and serializes
// `numeric` columns as strings. Only columns the mobile client actually
// consumes are selected — `public.venues` has additional columns
// (google_place_id, types[], rating, total_ratings, phone, website)
// not modeled here or in the shared Venue type.
export interface VenueRow {
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
  phone: string | null;
  website: string | null;
}

export const VENUE_COLUMNS =
  'id, name, primary_type, address, latitude, longitude, hotspot_score, vote_count, is_open, is_trending, highlights, price_level, hours, description, image_url, phone, website';

export function rowToVenue(row: VenueRow): Venue | null {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (__DEV__) {
      console.warn(`[venues] Venue ${row.id} (${row.name}) has invalid coordinates`, {
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    // Formatted here rather than at each render site so the card, list item,
    // map callout, and detail screen cannot disagree.
    primaryType: formatVenueType(row.primary_type),
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
    phone: row.phone,
    website: row.website,
  };
}

/** Drops rows whose coordinates could not be parsed, which `rowToVenue` nulls. */
export function rowsToVenues(rows: VenueRow[]): Venue[] {
  return rows.map(rowToVenue).filter((v): v is Venue => v !== null);
}
