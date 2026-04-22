import { describe, it, expect } from 'vitest';
import { placeToVenue } from '../../../src/jobs/places/transform.js';
import type { Place } from '../../../src/jobs/places/client.js';

const ctx = { cityId: 'city-uuid-1', cityName: 'Charlotte' };

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'ChIJtest',
    displayName: { text: 'Wooden Robot' },
    formattedAddress: '1440 S Tryon St',
    location: { latitude: 35.2082, longitude: -80.8622 },
    types: ['bar', 'night_club', 'restaurant'],
    primaryType: 'bar',
    rating: 4.6,
    userRatingCount: 220,
    ...overrides,
  };
}

describe('placeToVenue', () => {
  it('maps a fully-populated place to a NewVenue row', () => {
    const row = placeToVenue(
      makePlace({
        internationalPhoneNumber: '+1 704 555 0199',
        websiteUri: 'https://example.test',
        priceLevel: 'PRICE_LEVEL_MODERATE',
        regularOpeningHours: {
          weekdayDescriptions: ['Monday: 4:00 PM – 11:00 PM', 'Tuesday: 4:00 PM – 11:00 PM'],
        },
      }),
      ctx,
    );

    expect(row).not.toBeNull();
    expect(row!.cityId).toBe(ctx.cityId);
    expect(row!.googlePlaceId).toBe('ChIJtest');
    expect(row!.name).toBe('Wooden Robot');
    expect(row!.primaryType).toBe('bar');
    expect(row!.city).toBe('Charlotte');
    expect(row!.phone).toBe('+1 704 555 0199');
    expect(row!.website).toBe('https://example.test');
    expect(row!.priceLevel).toBe(2);
    expect(row!.rating).toBe('4.6');
    expect(row!.totalRatings).toBe(220);
    expect(row!.latitude).toBe('35.2082');
    expect(row!.longitude).toBe('-80.8622');
    expect(row!.location).toBe('POINT(-80.8622 35.2082)');
    expect(row!.hours).toBe('Monday: 4:00 PM – 11:00 PM\nTuesday: 4:00 PM – 11:00 PM');
  });

  it('filters types[] to only included bar-like types', () => {
    const row = placeToVenue(makePlace({ types: ['bar', 'restaurant', 'night_club'] }), ctx);
    expect(row!.types).toEqual(['bar', 'night_club']);
  });

  it('falls back to types[0] when primaryType is missing', () => {
    const row = placeToVenue(
      makePlace({ primaryType: undefined, types: ['night_club', 'bar'] }),
      ctx,
    );
    expect(row!.primaryType).toBe('night_club');
  });

  it('defaults primaryType to "bar" when both primaryType and included types are missing', () => {
    const row = placeToVenue(makePlace({ primaryType: undefined, types: ['restaurant'] }), ctx);
    expect(row!.primaryType).toBe('bar');
  });

  it('maps all PRICE_LEVEL_* strings to ints', () => {
    const cases: Array<[Place['priceLevel'], number]> = [
      ['PRICE_LEVEL_FREE', 0],
      ['PRICE_LEVEL_INEXPENSIVE', 1],
      ['PRICE_LEVEL_MODERATE', 2],
      ['PRICE_LEVEL_EXPENSIVE', 3],
      ['PRICE_LEVEL_VERY_EXPENSIVE', 4],
    ];
    for (const [level, expected] of cases) {
      const row = placeToVenue(makePlace({ priceLevel: level }), ctx);
      expect(row!.priceLevel).toBe(expected);
    }
  });

  it('leaves priceLevel null when the place has no price data', () => {
    const row = placeToVenue(makePlace({ priceLevel: undefined }), ctx);
    expect(row!.priceLevel).toBeNull();
  });

  it('leaves hours empty when no weekdayDescriptions present', () => {
    expect(placeToVenue(makePlace({ regularOpeningHours: undefined }), ctx)!.hours).toBe('');
    expect(
      placeToVenue(makePlace({ regularOpeningHours: { weekdayDescriptions: [] } }), ctx)!.hours,
    ).toBe('');
  });

  it('returns null when location is missing', () => {
    expect(placeToVenue(makePlace({ location: undefined }), ctx)).toBeNull();
  });

  it('returns null when displayName is missing', () => {
    expect(placeToVenue(makePlace({ displayName: undefined }), ctx)).toBeNull();
  });

  it('leaves rating null when not provided', () => {
    const row = placeToVenue(makePlace({ rating: undefined }), ctx);
    expect(row!.rating).toBeNull();
  });

  it('leaves phone and website null when not provided', () => {
    const row = placeToVenue(makePlace(), ctx);
    expect(row!.phone).toBeNull();
    expect(row!.website).toBeNull();
  });
});
