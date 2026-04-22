import { describe, it, expect } from 'vitest';
import { shouldKeep } from '../../../src/jobs/places/filters.js';
import type { Place } from '../../../src/jobs/places/client.js';

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'ChIJplaceholder',
    displayName: { text: 'Test Bar' },
    formattedAddress: '123 Main St',
    location: { latitude: 35.2271, longitude: -80.8431 },
    types: ['bar'],
    primaryType: 'bar',
    rating: 4.2,
    userRatingCount: 150,
    ...overrides,
  };
}

describe('shouldKeep', () => {
  it('keeps a canonical bar', () => {
    expect(shouldKeep(makePlace())).toBe(true);
  });

  it('keeps night clubs, pubs, wine bars', () => {
    for (const t of ['night_club', 'pub', 'wine_bar']) {
      expect(shouldKeep(makePlace({ types: [t] }))).toBe(true);
    }
  });

  it('drops places with excluded types even if they also look like a bar', () => {
    expect(shouldKeep(makePlace({ types: ['bar', 'liquor_store'] }))).toBe(false);
    expect(shouldKeep(makePlace({ types: ['bar', 'gas_station'] }))).toBe(false);
  });

  it('drops places with no included type', () => {
    expect(shouldKeep(makePlace({ types: ['restaurant'] }))).toBe(false);
    expect(shouldKeep(makePlace({ types: [] }))).toBe(false);
    expect(shouldKeep(makePlace({ types: undefined }))).toBe(false);
  });

  it('drops places below the rating threshold', () => {
    expect(shouldKeep(makePlace({ rating: 3.4 }))).toBe(false);
    expect(shouldKeep(makePlace({ rating: 3.5 }))).toBe(true);
    expect(shouldKeep(makePlace({ rating: undefined }))).toBe(false);
  });

  it('drops places below the review count threshold', () => {
    expect(shouldKeep(makePlace({ userRatingCount: 4 }))).toBe(false);
    expect(shouldKeep(makePlace({ userRatingCount: 5 }))).toBe(true);
    expect(shouldKeep(makePlace({ userRatingCount: undefined }))).toBe(false);
  });

  it('requires a location to keep', () => {
    expect(shouldKeep(makePlace({ location: undefined }))).toBe(false);
  });
});
