/**
 * Thin wrapper around Google Places API (New) and Geocoding API.
 *
 * Docs:
 *   - https://developers.google.com/maps/documentation/places/web-service/search-text
 *   - https://developers.google.com/maps/documentation/geocoding/requests-geocoding
 */

const PLACES_BASE = 'https://places.googleapis.com/v1';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const DEFAULT_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours',
  'places.photos',
  'nextPageToken',
].join(',');

export interface PlaceLocation {
  latitude: number;
  longitude: number;
}

export interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

export interface PlaceOpeningHours {
  weekdayDescriptions?: string[];
  periods?: Array<{
    open?: { day: number; hour: number; minute: number };
    close?: { day: number; hour: number; minute: number };
  }>;
}

export interface Place {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location?: PlaceLocation;
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?:
    | 'PRICE_LEVEL_UNSPECIFIED'
    | 'PRICE_LEVEL_FREE'
    | 'PRICE_LEVEL_INEXPENSIVE'
    | 'PRICE_LEVEL_MODERATE'
    | 'PRICE_LEVEL_EXPENSIVE'
    | 'PRICE_LEVEL_VERY_EXPENSIVE';
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: PlaceOpeningHours;
  photos?: PlacePhoto[];
}

export interface SearchTextResponse {
  places?: Place[];
  nextPageToken?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export class PlacesClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error('PlacesClient: apiKey is required');
  }

  async geocode(address: string): Promise<GeocodeResult> {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Geocode failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (json.status !== 'OK' || json.results.length === 0) {
      throw new Error(`Geocode ${json.status}: ${json.error_message ?? address}`);
    }
    const top = json.results[0];
    return {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      formattedAddress: top.formatted_address,
    };
  }

  /**
   * Places API (New) Text Search.
   *
   * searchText pages up to ~60 results (3 x 20). searchNearby only returns
   * one page of 20, so we use searchText for better coverage when seeding.
   */
  async searchText(params: {
    textQuery: string;
    includedType?: string;
    locationBias?: { circle: { center: PlaceLocation; radius: number } };
    maxResultCount?: number;
    pageToken?: string;
  }): Promise<SearchTextResponse> {
    const body: Record<string, unknown> = {
      textQuery: params.textQuery,
      maxResultCount: params.maxResultCount ?? 20,
    };
    if (params.includedType) body.includedType = params.includedType;
    if (params.locationBias) body.locationBias = params.locationBias;
    if (params.pageToken) body.pageToken = params.pageToken;

    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': DEFAULT_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`searchText failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as SearchTextResponse;
  }

  /**
   * Build a photo URL for the primary photo of a place. Requires a separate
   * request at render time; we store the name and resolve on demand.
   */
  buildPhotoUrl(photoName: string, maxWidthPx = 800): string {
    return `${PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${this.apiKey}`;
  }
}
