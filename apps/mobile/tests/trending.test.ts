import { describe, it, expect, vi } from 'vitest';

// Regression/acceptance tests for the Global Rankings mock trending source
// (#50): useTrending's mock branch sorts a city's venues by hotspotScore
// descending and caps the list at 10. We capture the real `queryFn` passed
// to `useQuery` (mocked here, same approach as tests/cities.test.ts) so we
// exercise the actual sort/slice logic without rendering React.

import { useQuery } from '@tanstack/react-query';
import { useTrending, trendingKeys } from '@/api/trending';
import { mockVenuesByCity, mockVenues } from '@/data/venues';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));

const useQueryMock = vi.mocked(useQuery);

// `useTrending` is invoked directly (not from a component) purely to capture
// the `queryFn` closure passed to the mocked `useQuery` — no hook state is
// actually read, so the rules-of-hooks lint rule doesn't apply here.
function getQueryFn(city: string): () => Promise<unknown> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useTrending(city);
  const lastCall = useQueryMock.mock.calls.at(-1);
  const config = lastCall?.[0] as unknown as { queryFn: () => Promise<unknown> };
  return config.queryFn;
}

describe('trendingKeys', () => {
  it('scopes the query key by city so switching cities produces a distinct key', () => {
    expect(trendingKeys.list('Charlotte, NC')).toEqual(['trending', 'list', 'Charlotte, NC']);
    expect(trendingKeys.list('Patchogue, NY')).toEqual(['trending', 'list', 'Patchogue, NY']);
    expect(trendingKeys.list('Charlotte, NC')).not.toEqual(trendingKeys.list('Patchogue, NY'));
  });
});

describe('useTrending mock branch (EXPO_PUBLIC_API_URL unset)', () => {
  it("sorts a city's venues by hotspotScore descending", async () => {
    const queryFn = getQueryFn('Charlotte, NC');
    const result = (await queryFn()) as { hotspotScore: number }[];

    const scores = result.map((v) => v.hotspotScore);
    const sortedDesc = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sortedDesc);
    // Sanity: Charlotte's mock data actually has distinct scores, so this
    // assertion is a real check on ordering, not a vacuous no-op.
    expect(new Set(scores).size).toBe(scores.length);
  });

  it('does not blow up when a city has fewer than 10 venues (returns all of them)', async () => {
    const queryFn = getQueryFn('Charlotte, NC');
    const result = (await queryFn()) as unknown[];
    expect(mockVenuesByCity['Charlotte, NC'].length).toBeLessThan(10);
    expect(result.length).toBe(mockVenuesByCity['Charlotte, NC'].length);
  });

  it('caps the result at 10 venues when a city has more than 10', async () => {
    const queryFn = getQueryFn('__all_venues_fixture__');
    // No city keyed '__all_venues_fixture__' exists, so this exercises the
    // `?? mockVenues` fallback (12 venues across both mock cities) — the
    // combined set is > 10, proving the slice actually caps the list.
    expect(mockVenues.length).toBeGreaterThan(10);
    const result = (await queryFn()) as unknown[];
    expect(result.length).toBe(10);
  });

  it('ties are kept but do not reorder unrelated entries incorrectly (stable-ish check)', async () => {
    // Construct a synthetic scenario using the real sort semantics by
    // re-deriving expected order directly from source data with a manual
    // stable sort, guarding against off-by-one comparator bugs (e.g. `a - b`
    // instead of `b - a`).
    const queryFn = getQueryFn('Patchogue, NY');
    const result = (await queryFn()) as { id: string; hotspotScore: number }[];
    const expected = [...mockVenuesByCity['Patchogue, NY']].sort(
      (a, b) => b.hotspotScore - a.hotspotScore
    );
    expect(result.map((v) => v.id)).toEqual(expected.map((v) => v.id));
  });

  it('an unknown city falls back to the full cross-city mock list rather than an empty leaderboard', async () => {
    // This documents existing behavior shared with useVenues' identical
    // `mockVenuesByCity[city] ?? mockVenues` fallback: an unrecognized city
    // key resolves to ALL cities' venues, not zero. In this app the
    // CitySelector only ever offers cities present in mockVenuesByCity, so
    // this path is unreachable through normal navigation — but the queryFn
    // itself does not distinguish "unknown city" from "known city with no
    // venues" and would silently show a mixed-city leaderboard if that
    // assumption ever broke (e.g. a new city added to `mockCities` without
    // a matching `mockVenuesByCity` entry).
    const queryFn = getQueryFn('Nowhere, ZZ');
    const result = (await queryFn()) as { id: string }[];
    expect(result.length).toBeGreaterThan(0);
    const ids = new Set(mockVenues.map((v) => v.id));
    expect(result.every((v) => ids.has(v.id))).toBe(true);
  });
});
