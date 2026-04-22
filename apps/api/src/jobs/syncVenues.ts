/**
 * Venue sync job: fetch bars/clubs from Google Places (New) and upsert into
 * the `venues` table for a given city. Idempotent via `google_place_id`.
 */
import { and, eq, isNotNull, notInArray } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { cities, venues, type NewCity, type NewVenue } from '../db/schema.js';
import { PlacesClient, type Place } from './places/client.js';
import { INCLUDED_TYPES, shouldKeep } from './places/filters.js';
import { placeToVenue } from './places/transform.js';

export interface SyncCityInput {
  city: string;
  state: string;
  radiusMeters?: number;
  maxResultsPerType?: number;
  log?: (msg: string) => void;
}

export interface SyncCityResult {
  citySlug: string;
  cityId: string;
  placesFound: number;
  venuesUpserted: number;
  errors: Array<{ placeId?: string; name?: string; error: string }>;
}

function slugify(city: string, state: string): string {
  const s = `${city}-${state}`.toLowerCase().trim();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureCity(input: {
  city: string;
  state: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}): Promise<{ id: string; slug: string }> {
  const db = getDb();
  const slug = slugify(input.city, input.state);

  const row: NewCity = {
    slug,
    name: input.city,
    state: input.state,
    centerLat: input.centerLat.toString(),
    centerLng: input.centerLng.toString(),
    radiusMeters: input.radiusMeters,
    isActive: true,
  };

  const [saved] = await db
    .insert(cities)
    .values(row)
    .onConflictDoUpdate({
      target: cities.slug,
      set: {
        name: row.name,
        state: row.state,
        centerLat: row.centerLat,
        centerLng: row.centerLng,
        radiusMeters: row.radiusMeters,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: cities.id, slug: cities.slug });

  return saved;
}

async function upsertVenues(rows: NewVenue[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();

  let count = 0;
  for (const row of rows) {
    await db
      .insert(venues)
      .values(row)
      .onConflictDoUpdate({
        target: venues.googlePlaceId,
        set: {
          name: row.name,
          primaryType: row.primaryType,
          types: row.types,
          address: row.address,
          city: row.city,
          cityId: row.cityId,
          location: row.location,
          latitude: row.latitude,
          longitude: row.longitude,
          rating: row.rating,
          totalRatings: row.totalRatings,
          priceLevel: row.priceLevel,
          phone: row.phone,
          website: row.website,
          hours: row.hours,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    count += 1;
  }
  return count;
}

export async function syncCity(input: SyncCityInput): Promise<SyncCityResult> {
  const log = input.log ?? (() => undefined);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set');

  const radiusMeters = input.radiusMeters ?? 8000;
  const maxPerType = input.maxResultsPerType ?? 20;

  const places = new PlacesClient(apiKey);

  log(`Geocoding ${input.city}, ${input.state}...`);
  const center = await places.geocode(`${input.city}, ${input.state}`);
  log(`  center: ${center.lat}, ${center.lng}`);

  const city = await ensureCity({
    city: input.city,
    state: input.state,
    centerLat: center.lat,
    centerLng: center.lng,
    radiusMeters,
  });
  log(`  city row: ${city.slug} (${city.id})`);

  // Search for each included type separately — searchText takes one
  // includedType at a time.
  const locationBias = {
    circle: {
      center: { latitude: center.lat, longitude: center.lng },
      radius: radiusMeters,
    },
  };

  const seen = new Map<string, Place>();
  const errors: SyncCityResult['errors'] = [];

  for (const type of INCLUDED_TYPES) {
    log(`Searching type="${type}"...`);
    let pageToken: string | undefined;
    let page = 0;
    // Places API (New) caps searchText at 3 pages (~60 results) per query.
    while (page < 3) {
      try {
        const res = await places.searchText({
          textQuery: `${type.replace('_', ' ')} in ${input.city}, ${input.state}`,
          includedType: type,
          locationBias,
          maxResultCount: maxPerType,
          pageToken,
        });
        for (const p of res.places ?? []) {
          if (!seen.has(p.id) && shouldKeep(p)) seen.set(p.id, p);
        }
        pageToken = res.nextPageToken;
        if (!pageToken) break;
        page += 1;
        // Google recommends a short delay before requesting the next page.
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        errors.push({ error: `searchText(${type}): ${(e as Error).message}` });
        break;
      }
    }
  }

  log(`Filtered ${seen.size} unique places.`);

  const rows: NewVenue[] = [];
  for (const place of seen.values()) {
    const row = placeToVenue(place, { cityId: city.id, cityName: input.city });
    if (row) rows.push(row);
    else errors.push({ placeId: place.id, name: place.displayName?.text, error: 'transform skipped' });
  }

  const upserted = await upsertVenues(rows);
  log(`Upserted ${upserted} venues for ${city.slug}.`);

  // Soft-deactivate venues in this city that weren't in this sync.
  const activeIds = rows.map((r) => r.googlePlaceId).filter(Boolean) as string[];
  if (activeIds.length > 0) {
    const db = getDb();
    await db
      .update(venues)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(venues.cityId, city.id),
          isNotNull(venues.googlePlaceId),
          notInArray(venues.googlePlaceId, activeIds),
        ),
      );
  }

  return {
    citySlug: city.slug,
    cityId: city.id,
    placesFound: seen.size,
    venuesUpserted: upserted,
    errors,
  };
}

