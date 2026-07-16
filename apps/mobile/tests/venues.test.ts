import { describe, it, expect, vi, afterEach } from 'vitest';

// Regression coverage for GitHub issue #78 / Path A: the Supabase-direct read
// tier added to src/api/venues.ts between the Railway API tier and the mock
// fallback. `hasApi`/`hasSupabase` are read once at module load (see
// src/lib/env.ts), so each scenario stubs env vars and re-imports the module
// fresh via `vi.resetModules()` — same pattern as tests/env.test.ts and
// tests/boot-smoke.test.ts.

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
// useQuery is mocked to just return its options object so we can invoke the
// real queryFn directly without rendering a component or a QueryClient.
vi.mock('@tanstack/react-query', () => ({ useQuery: (opts: any) => opts }));

/** A chainable, thenable stand-in for the supabase-js query builder. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

async function loadVenues() {
  vi.resetModules();
  return import('@/api/venues');
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
  latitude: '35.228700', // numeric columns serialize as strings over supabase-js
  longitude: '-80.841900',
  hotspot_score: 91,
  vote_count: 512,
  is_open: true,
  is_trending: true,
  highlights: ['Rooftop', 'Craft Cocktails'],
  price_level: 3,
  hours: '4 PM – 1 AM',
  description: 'Uptown rooftop lounge.',
  image_url: 'https://example.com/img.jpg',
};

describe('useVenues tier selection', () => {
  it('uses bundled mock data when neither hasApi nor hasSupabase is set', async () => {
    stubTier({});
    const { useVenues } = await loadVenues();
    const result = await (useVenues('Charlotte, NC', []) as any).queryFn();
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toMatch(/^clt-/);
  });

  it('reads from Supabase when hasSupabase is true and hasApi is false', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    supabaseMock.from.mockReturnValue(makeBuilder({ data: [SAMPLE_ROW], error: null }));
    const { useVenues } = await loadVenues();
    const result = await (useVenues('Charlotte, NC', []) as any).queryFn();
    expect(supabaseMock.from).toHaveBeenCalledWith('venues');
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
        highlights: ['Rooftop', 'Craft Cocktails'],
        latitude: 35.2287,
        longitude: -80.8419,
        imageUrl: 'https://example.com/img.jpg',
        priceLevel: 3,
        hours: '4 PM – 1 AM',
        description: 'Uptown rooftop lounge.',
      },
    ]);
  });

  it('filters out rows with non-finite coordinates instead of crashing', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const badRow = { ...SAMPLE_ROW, id: 'v-bad', latitude: 'not-a-number', longitude: null };
    supabaseMock.from.mockReturnValue(makeBuilder({ data: [badRow, SAMPLE_ROW], error: null }));
    const { useVenues } = await loadVenues();
    const result = await (useVenues('Charlotte, NC', []) as any).queryFn();
    expect(result.map((v: { id: string }) => v.id)).toEqual(['v-1']);
  });

  it('propagates a Supabase error into the query rejection instead of silently returning empty data', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const dbError = { message: 'relation "venues" does not exist' };
    supabaseMock.from.mockReturnValue(makeBuilder({ data: null, error: dbError }));
    const { useVenues } = await loadVenues();
    await expect((useVenues('Charlotte, NC', []) as any).queryFn()).rejects.toEqual(dbError);
  });

  it('prefers the Railway API tier over Supabase when both are configured', async () => {
    // Stub fetch (no real network) so the API-tier branch resolves without
    // hitting the wire; this only needs to prove Supabase is never touched
    // when hasApi is true.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ data: [] }) }))
    );
    stubTier({
      api: 'https://api.example.com/api/v1',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
    });
    const { useVenues } = await loadVenues();
    const result = await (useVenues('Charlotte, NC', []) as any).queryFn();
    expect(result).toEqual([]);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});

describe('useVenue (detail) tier selection', () => {
  it('falls back to mock data when neither tier is configured', async () => {
    stubTier({});
    const { useVenue } = await loadVenues();
    const result = await (useVenue('clt-1') as any).queryFn();
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result?.id).toBe('clt-1');
  });

  it('maps a single Supabase row to the Venue shape', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    supabaseMock.from.mockReturnValue(makeBuilder({ data: SAMPLE_ROW, error: null }));
    const { useVenue } = await loadVenues();
    const result = await (useVenue('v-1') as any).queryFn();
    expect(supabaseMock.from).toHaveBeenCalledWith('venues');
    expect(result).toMatchObject({
      id: 'v-1',
      name: 'Merchant & Trade',
      primaryType: 'Rooftop Bar',
      latitude: 35.2287,
      longitude: -80.8419,
    });
  });

  it('returns undefined (not an error) when Supabase finds no matching row', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    supabaseMock.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const { useVenue } = await loadVenues();
    const result = await (useVenue('missing-id') as any).queryFn();
    expect(result).toBeUndefined();
  });

  it('throws when Supabase returns an error for the detail query', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const dbError = { message: 'network error' };
    supabaseMock.from.mockReturnValue(makeBuilder({ data: null, error: dbError }));
    const { useVenue } = await loadVenues();
    await expect((useVenue('v-1') as any).queryFn()).rejects.toEqual(dbError);
  });
});
