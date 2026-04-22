import type { NewVenue } from '../../db/schema.js';
import type { Place, PlaceOpeningHours } from './client.js';
import { INCLUDED_TYPES } from './filters.js';

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export interface TransformContext {
  cityId: string;
  cityName: string;
}

export function placeToVenue(place: Place, ctx: TransformContext): NewVenue | null {
  if (!place.location || !place.displayName?.text) return null;

  const types = (place.types ?? []).filter((t) => INCLUDED_TYPES.has(t));
  const primaryType = place.primaryType ?? types[0] ?? 'bar';

  return {
    cityId: ctx.cityId,
    googlePlaceId: place.id,
    name: place.displayName.text,
    type: primaryType,
    types,
    address: place.formattedAddress ?? '',
    city: ctx.cityName,
    location: `POINT(${place.location.longitude} ${place.location.latitude})`,
    latitude: place.location.latitude.toString(),
    longitude: place.location.longitude.toString(),
    rating: place.rating !== undefined ? place.rating.toString() : null,
    totalRatings: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null) : null,
    phone: place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    hours: formatHours(place.regularOpeningHours),
  };
}

function formatHours(hours?: PlaceOpeningHours): string {
  if (!hours?.weekdayDescriptions?.length) return '';
  return hours.weekdayDescriptions.join('\n');
}
