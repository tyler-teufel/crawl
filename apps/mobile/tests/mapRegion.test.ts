import { describe, it, expect } from 'vitest';
import { getRegionForCity } from '@/lib/mapRegion';

// Live `public.cities` values (verified 2026-07-28, see #166).
const CHARLOTTE = { centerLat: 35.2271, centerLng: -80.8409, radiusMeters: 8000 };
const SOUTH_END = { centerLat: 35.2126, centerLng: -80.8588, radiusMeters: 2500 };
const SAYVILLE = { centerLat: 40.7359, centerLng: -73.0821, radiusMeters: 250 };
const PATCHOGUE = { centerLat: 40.766, centerLng: -73.0193, radiusMeters: 2500 };

describe('getRegionForCity', () => {
  it('centers the region on the city, not an arbitrary venue', () => {
    const region = getRegionForCity(CHARLOTTE);
    expect(region.latitude).toBe(CHARLOTTE.centerLat);
    expect(region.longitude).toBe(CHARLOTTE.centerLng);
  });

  it('scales latitudeDelta with radiusMeters', () => {
    const sayville = getRegionForCity(SAYVILLE);
    const charlotte = getRegionForCity(CHARLOTTE);
    // Sayville's radius (250m) is 32x smaller than Charlotte's (8000m) —
    // the resulting delta should shrink by the same factor.
    expect(charlotte.latitudeDelta / sayville.latitudeDelta).toBeCloseTo(8000 / 250, 5);
  });

  it('does not render Sayville and Charlotte at the same zoom level', () => {
    const sayville = getRegionForCity(SAYVILLE);
    const charlotte = getRegionForCity(CHARLOTTE);
    expect(sayville.latitudeDelta).not.toBeCloseTo(charlotte.latitudeDelta, 3);
    expect(sayville.longitudeDelta).not.toBeCloseTo(charlotte.longitudeDelta, 3);
  });

  it('gives equal-radius cities at different latitudes the same latitudeDelta', () => {
    // South End and Patchogue share a radius (2500m) but sit at different
    // latitudes — latitudeDelta depends only on radius, not latitude.
    const southEnd = getRegionForCity(SOUTH_END);
    const patchogue = getRegionForCity(PATCHOGUE);
    expect(southEnd.latitudeDelta).toBeCloseTo(patchogue.latitudeDelta, 10);
  });

  it('widens longitudeDelta relative to latitudeDelta the further a city sits from the equator', () => {
    // Patchogue (~40.77°N) is further from the equator than South End
    // (~35.21°N), so 1/cos(lat) is larger and the same physical east-west
    // distance needs more degrees of longitude to cover.
    const southEnd = getRegionForCity(SOUTH_END);
    const patchogue = getRegionForCity(PATCHOGUE);
    const southEndRatio = southEnd.longitudeDelta / southEnd.latitudeDelta;
    const patchogueRatio = patchogue.longitudeDelta / patchogue.latitudeDelta;
    expect(patchogueRatio).toBeGreaterThan(southEndRatio);
  });

  it('floors a missing/zero radius instead of zooming in to a single point', () => {
    const region = getRegionForCity({ centerLat: 35.2271, centerLng: -80.8409, radiusMeters: 0 });
    expect(region.latitudeDelta).toBeGreaterThan(0);
    expect(region.longitudeDelta).toBeGreaterThan(0);
  });
});
