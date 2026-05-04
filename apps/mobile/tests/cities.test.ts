import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));

import { findNearestCity, rowToCity } from '@/api/cities';
import type { City } from '@/api/cities';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCity(overrides: Partial<City> & { centerLat: number; centerLng: number }): City {
  return {
    id: '1',
    slug: 'test',
    name: 'Test',
    state: 'TX',
    displayName: 'Test, TX',
    ...overrides,
  };
}

// Charlotte, NC — used as a known reference point
const CHARLOTTE = makeCity({
  id: 'clt',
  slug: 'charlotte',
  name: 'Charlotte',
  state: 'NC',
  displayName: 'Charlotte, NC',
  centerLat: 35.2271,
  centerLng: -80.8431,
});

// London — ~4,300 miles from Charlotte
const LONDON = makeCity({
  id: 'lon',
  slug: 'london',
  name: 'London',
  state: 'UK',
  displayName: 'London, UK',
  centerLat: 51.5074,
  centerLng: -0.1278,
});

// Same lat as Charlotte but 1.5 degrees north (~103 miles away)
const FAR_CITY = makeCity({
  centerLat: 36.7271,
  centerLng: -80.8431,
});

// Same lat as Charlotte but 0.003 degrees north (~0.2 miles away)
const CLOSE_CITY = makeCity({
  id: 'close',
  centerLat: 35.2301,
  centerLng: -80.8431,
});

// ---------------------------------------------------------------------------
// rowToCity
// ---------------------------------------------------------------------------

describe('rowToCity', () => {
  it('maps snake_case row to City shape', () => {
    const result = rowToCity({
      id: '42',
      slug: 'denver',
      name: 'Denver',
      state: 'CO',
      center_lat: '39.7392',
      center_lng: '-104.9903',
    });
    expect(result.id).toBe('42');
    expect(result.slug).toBe('denver');
    expect(result.name).toBe('Denver');
    expect(result.state).toBe('CO');
    expect(result.displayName).toBe('Denver, CO');
    expect(result.centerLat).toBe(39.7392);
    expect(result.centerLng).toBe(-104.9903);
  });

  it('coerces string lat/lng to numbers', () => {
    const result = rowToCity({
      id: '1',
      slug: 'x',
      name: 'X',
      state: 'TX',
      center_lat: '30.2672',
      center_lng: '-97.7431',
    });
    expect(typeof result.centerLat).toBe('number');
    expect(typeof result.centerLng).toBe('number');
  });

  it('handles numeric lat/lng that are already numbers', () => {
    const result = rowToCity({
      id: '1',
      slug: 'x',
      name: 'X',
      state: 'TX',
      center_lat: 30.2672,
      center_lng: -97.7431,
    });
    expect(result.centerLat).toBe(30.2672);
    expect(result.centerLng).toBe(-97.7431);
  });
});

// ---------------------------------------------------------------------------
// findNearestCity
// ---------------------------------------------------------------------------

const CHARLOTTE_LOCATION = { latitude: 35.2271, longitude: -80.8431 };

describe('findNearestCity', () => {
  it('returns null for empty cities array', () => {
    expect(findNearestCity([], CHARLOTTE_LOCATION)).toBeNull();
  });

  it('returns null when the nearest city exceeds maxMiles', () => {
    expect(findNearestCity([LONDON], CHARLOTTE_LOCATION, 50)).toBeNull();
  });

  it('returns the city when it is within default maxMiles (50)', () => {
    const result = findNearestCity([CHARLOTTE], CHARLOTTE_LOCATION);
    expect(result).toEqual(CHARLOTTE);
  });

  it('returns null when all cities exceed the default 50-mile radius', () => {
    expect(findNearestCity([FAR_CITY], CHARLOTTE_LOCATION)).toBeNull();
  });

  it('returns the closer city when multiple cities are within range', () => {
    const result = findNearestCity([FAR_CITY, CLOSE_CITY, CHARLOTTE], CHARLOTTE_LOCATION);
    // CLOSE_CITY is ~0.2 miles away; CHARLOTTE is ~0 miles; FAR_CITY is ~103 miles (excluded)
    expect(result).toEqual(CHARLOTTE);
  });

  it('respects a custom maxMiles override', () => {
    // CHARLOTTE is 0 miles away so should always match; FAR_CITY would be excluded at maxMiles=50
    expect(findNearestCity([FAR_CITY], CHARLOTTE_LOCATION, 200)).toEqual(FAR_CITY);
    expect(findNearestCity([FAR_CITY], CHARLOTTE_LOCATION, 50)).toBeNull();
  });
});
