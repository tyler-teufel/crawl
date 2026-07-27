import { describe, it, expect, vi, afterEach } from 'vitest';

// Regression/acceptance tests for the Global Rankings mock trending source
// (#50): getMockTrending sorts a city's venues by hotspotScore descending and
// caps the list at 10. Tested directly as a standalone function (like
// tests/cities.test.ts does for rowToCity/findNearestCity), no React Query
// mocking required.
//
// The tier-selection block at the bottom covers #150: useTrending had no
// Supabase branch, so Global Rankings served bundled mock venues on every
// Supabase-direct build while Explore read live data.

import { getMockTrending, trendingKeys } from '@/api/trending';
import { mockVenuesByCity, mockVenues } from '@/data/venues';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
const resolveCityIdMock = vi.hoisted(() => vi.fn(async () => 'city-uuid-charlotte'));

/** The cities row id 'Charlotte, NC' resolves to in these tests. */
const CITY_ID = 'city-uuid-charlotte';

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (opts: any) => opts }));
vi.mock('@/api/cities', () => ({ resolveCityId: resolveCityIdMock }));
vi.mock('@/api/query-client', () => ({ queryClient: {} }));

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

// ── Tier selection (#150) ────────────────────────────────────────────────────

/** A chainable, thenable stand-in for the supabase-js query builder. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

async function loadTrending() {
  vi.resetModules();
  return import('@/api/trending');
}

function stubTier(opts: { api?: string; supabaseUrl?: string; supabaseKey?: string }) {
  vi.stubEnv('EXPO_PUBLIC_API_URL', opts.api ?? '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', opts.supabaseUrl ?? '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', opts.supabaseKey ?? '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

const SAMPLE_ROW = {
  id: 'v-1',
  name: 'Merchant & Trade',
  primary_type: 'Rooftop Bar',
  address: '525 N Tryon St, Charlotte',
  latitude: '35.228700',
  longitude: '-80.841900',
  hotspot_score: 91,
  vote_count: 512,
  is_open: true,
  is_trending: true,
  highlights: ['Rooftop'],
  price_level: 3,
  hours: '4 PM – 1 AM',
  description: 'Uptown rooftop lounge.',
  image_url: null,
};

describe('useTrending tier selection', () => {
  it('reads live venues from Supabase when hasSupabase is true and hasApi is false', async () => {
    // This is the exact staging configuration (#128 leaves EXPO_PUBLIC_API_URL
    // unset), and the one that silently served mock data before #150.
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const builder = makeBuilder({ data: [SAMPLE_ROW], error: null });
    supabaseMock.from.mockReturnValue(builder);

    const { useTrending } = await loadTrending();
    const result = await (useTrending('Charlotte, NC') as any).queryFn();

    expect(supabaseMock.from).toHaveBeenCalledWith('venues');
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.eq).toHaveBeenCalledWith('city_id', CITY_ID);
    expect(builder.order).toHaveBeenCalledWith('hotspot_score', { ascending: false });
    // Deterministic tiebreak — every live venue currently scores 0, so without
    // it `limit(10)` would return a different arbitrary slice each refetch.
    expect(builder.order).toHaveBeenCalledWith('name');
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([
      {
        id: 'v-1',
        name: 'Merchant & Trade',
        primaryType: 'Rooftop Bar',
        address: '525 N Tryon St, Charlotte',
        distance: '',
        hotspotScore: 91,
        voteCount: 512,
        isOpen: true,
        isTrending: true,
        highlights: ['Rooftop'],
        latitude: 35.2287,
        longitude: -80.8419,
        imageUrl: undefined,
        priceLevel: 3,
        hours: '4 PM – 1 AM',
        description: 'Uptown rooftop lounge.',
      },
    ]);
  });

  it('does NOT fall through to bundled mock venues when Supabase is configured', async () => {
    // The failure mode this ticket exists for: mock venues rendered as if they
    // were live rankings, with no signal to the user that they were fabricated.
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    supabaseMock.from.mockReturnValue(makeBuilder({ data: [], error: null }));

    const { useTrending } = await loadTrending();
    const result = await (useTrending('Charlotte, NC') as any).queryFn();

    expect(result).toEqual([]);
    const mockNames = mockVenuesByCity['Charlotte, NC'].map((v) => v.name);
    expect(mockNames).toContain('Merchant & Trade');
    expect(supabaseMock.from).toHaveBeenCalledWith('venues');
  });

  it('propagates a Supabase error instead of silently degrading to mock data', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const dbError = { message: 'permission denied for table venues' };
    supabaseMock.from.mockReturnValue(makeBuilder({ data: null, error: dbError }));

    const { useTrending } = await loadTrending();
    await expect((useTrending('Charlotte, NC') as any).queryFn()).rejects.toEqual(dbError);
  });

  it('still uses bundled mock data when neither tier is configured', async () => {
    stubTier({});
    const { useTrending } = await loadTrending();
    const result = await (useTrending('Charlotte, NC') as any).queryFn();

    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result).toEqual(getMockTrending('Charlotte, NC'));
  });

  it('prefers the Railway API tier over Supabase when both are configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => [] }))
    );
    stubTier({
      api: 'https://api.example.com/api/v1',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
    });
    const { useTrending } = await loadTrending();
    const result = await (useTrending('Charlotte, NC') as any).queryFn();

    expect(result).toEqual([]);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
