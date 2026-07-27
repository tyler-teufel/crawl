import { describe, it, expect } from 'vitest';

// Regression/acceptance tests for the Global Rankings mock trending source
// (#50): getMockTrending sorts a city's venues by hotspotScore descending and
// caps the list at 10. Tested directly as a standalone function (like
// tests/cities.test.ts does for rowToCity/findNearestCity), no React Query
// mocking required.

import { getMockTrending, trendingKeys } from '@/api/trending';
import { mockVenuesByCity, mockVenues } from '@/data/venues';

describe('trendingKeys', () => {
  it('scopes the query key by city so switching cities produces a distinct key', () => {
    expect(trendingKeys.list('Charlotte, NC')).toEqual(['trending', 'list', 'Charlotte, NC']);
    expect(trendingKeys.list('Patchogue, NY')).toEqual(['trending', 'list', 'Patchogue, NY']);
    expect(trendingKeys.list('Charlotte, NC')).not.toEqual(trendingKeys.list('Patchogue, NY'));
  });
});

describe('getMockTrending', () => {
  it("sorts a city's venues by hotspotScore descending", () => {
    const result = getMockTrending('Charlotte, NC');

    const scores = result.map((v) => v.hotspotScore);
    const sortedDesc = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sortedDesc);
    // Sanity: Charlotte's mock data actually has distinct scores, so this
    // assertion is a real check on ordering, not a vacuous no-op.
    expect(new Set(scores).size).toBe(scores.length);
  });

  it('does not blow up when a city has fewer than 10 venues (returns all of them)', () => {
    const result = getMockTrending('Charlotte, NC');
    expect(mockVenuesByCity['Charlotte, NC'].length).toBeLessThan(10);
    expect(result.length).toBe(mockVenuesByCity['Charlotte, NC'].length);
  });

  it('caps the result at 10 venues when a city has more than 10', () => {
    // No city keyed '__all_venues_fixture__' exists, so this exercises the
    // `?? mockVenues` fallback (12 venues across both mock cities) — the
    // combined set is > 10, proving the slice actually caps the list.
    expect(mockVenues.length).toBeGreaterThan(10);
    const result = getMockTrending('__all_venues_fixture__');
    expect(result.length).toBe(10);
  });

  it('ties are kept but do not reorder unrelated entries incorrectly (stable-ish check)', () => {
    // Construct a synthetic scenario using the real sort semantics by
    // re-deriving expected order directly from source data with a manual
    // stable sort, guarding against off-by-one comparator bugs (e.g. `a - b`
    // instead of `b - a`).
    const result = getMockTrending('Patchogue, NY');
    const expected = [...mockVenuesByCity['Patchogue, NY']].sort(
      (a, b) => b.hotspotScore - a.hotspotScore
    );
    expect(result.map((v) => v.id)).toEqual(expected.map((v) => v.id));
  });

  it('an unknown city falls back to the full cross-city mock list rather than an empty leaderboard', () => {
    // This documents existing behavior shared with useVenues' identical
    // `mockVenuesByCity[city] ?? mockVenues` fallback: an unrecognized city
    // key resolves to ALL cities' venues, not zero. In this app the
    // CitySelector only ever offers cities present in mockVenuesByCity, so
    // this path is unreachable through normal navigation — but the function
    // itself does not distinguish "unknown city" from "known city with no
    // venues" and would silently show a mixed-city leaderboard if that
    // assumption ever broke (e.g. a new city added to `mockCities` without
    // a matching `mockVenuesByCity` entry).
    const result = getMockTrending('Nowhere, ZZ');
    expect(result.length).toBeGreaterThan(0);
    const ids = new Set(mockVenues.map((v) => v.id));
    expect(result.every((v) => ids.has(v.id))).toBe(true);
  });
});
