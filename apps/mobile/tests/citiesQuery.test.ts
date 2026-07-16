import { describe, it, expect, vi, afterEach } from 'vitest';

// Regression coverage for GitHub issue #78 / Path A: the Supabase-direct read
// tier added to src/api/cities.ts's `useCities()`. `hasSupabase` is read from
// `@/lib/env`, which computes its exports once at module load, so each
// scenario stubs env vars and re-imports the module fresh via
// `vi.resetModules()` — same pattern as tests/env.test.ts. This file is
// separate from tests/cities.test.ts (which covers the pure `rowToCity` /
// `findNearestCity` helpers) to keep the module-reset dance isolated.

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
// useQuery is mocked to just return its options object so we can invoke the
// real queryFn directly without rendering a component or a QueryClient.
vi.mock('@tanstack/react-query', () => ({ useQuery: (opts: any) => opts }));

/** A chainable, thenable stand-in for the supabase-js query builder. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

async function loadCities() {
  vi.resetModules();
  return import('@/api/cities');
}

function stubTier(opts: { supabaseUrl?: string; supabaseKey?: string }) {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', opts.supabaseUrl ?? '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', opts.supabaseKey ?? '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

const SAMPLE_ROW = {
  id: 'c-1',
  slug: 'denver',
  name: 'Denver',
  state: 'CO',
  center_lat: '39.7392',
  center_lng: '-104.9903',
};

describe('useCities tier selection', () => {
  it('falls back to bundled mock cities when hasSupabase is false', async () => {
    stubTier({});
    const { useCities } = await loadCities();
    const result = await (useCities() as any).queryFn();
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });

  it('reads from Supabase and maps rows via rowToCity when hasSupabase is true', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    supabaseMock.from.mockReturnValue(makeBuilder({ data: [SAMPLE_ROW], error: null }));
    const { useCities } = await loadCities();
    const result = await (useCities() as any).queryFn();
    expect(supabaseMock.from).toHaveBeenCalledWith('cities');
    expect(result).toEqual([
      {
        id: 'c-1',
        slug: 'denver',
        name: 'Denver',
        state: 'CO',
        centerLat: 39.7392,
        centerLng: -104.9903,
        displayName: 'Denver, CO',
      },
    ]);
  });

  it('propagates a Supabase error into the query rejection instead of silently returning empty data', async () => {
    stubTier({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' });
    const dbError = { message: 'relation "cities" does not exist' };
    supabaseMock.from.mockReturnValue(makeBuilder({ data: null, error: dbError }));
    const { useCities } = await loadCities();
    await expect((useCities() as any).queryFn()).rejects.toEqual(dbError);
  });
});
