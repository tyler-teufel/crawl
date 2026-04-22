import type { Place } from './client.js';

export const INCLUDED_TYPES = new Set(['bar', 'night_club', 'pub', 'wine_bar']);

export const EXCLUDED_TYPES = new Set([
  'liquor_store',
  'convenience_store',
  'grocery_or_supermarket',
  'supermarket',
  'meal_delivery',
  'meal_takeaway',
  'gas_station',
  'lodging',
]);

export const MIN_RATING = 3.5;
export const MIN_REVIEWS = 5;

export function shouldKeep(place: Place): boolean {
  const types = new Set(place.types ?? []);
  if ([...types].some((t) => EXCLUDED_TYPES.has(t))) return false;
  if (![...types].some((t) => INCLUDED_TYPES.has(t))) return false;
  if ((place.rating ?? 0) < MIN_RATING) return false;
  if ((place.userRatingCount ?? 0) < MIN_REVIEWS) return false;
  if (!place.location) return false;
  return true;
}
