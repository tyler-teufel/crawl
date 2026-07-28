import { describe, it, expect, vi } from 'vitest';
import { resolveCityId, type City } from '@/api/cities';

// Direct unit coverage for the real `resolveCityId` implementation (#149).
//
// tests/venues.test.ts and tests/trending.test.ts both mock '@/api/cities'
// entirely and only prove that useVenues/useTrending propagate whatever
// resolveCityId does — they never call the real function, so neither pins
// that resolveCityId itself throws (rather than e.g. resolving to `undefined`
// or an empty string) when a display name has no matching city row. This
// file exercises the real implementation against a stub QueryClient.
//
// '@/lib/supabase' is mocked (same as tests/citiesQuery.test.ts) purely so
// importing '@/api/cities' doesn't pull the real supabase-js client — and
// transitively react-native — into this Node-environment test file. `vi.mock`
// calls are hoisted above imports by Vitest regardless of source position.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const CITIES: City[] = [
  {
    id: 'city-uuid-charlotte',
    slug: 'charlotte',
    name: 'Charlotte',
    state: 'NC',
    centerLat: 35.2271,
    centerLng: -80.8431,
    radiusMeters: 8000,
    displayName: 'Charlotte, NC',
  },
];

/** Minimal stand-in for QueryClient — only `fetchQuery` is called. */
function makeClient(cities: City[]) {
  return { fetchQuery: async () => cities } as any;
}

describe('resolveCityId (real implementation)', () => {
  it('resolves a known display name to its cities.id', async () => {
    const id = await resolveCityId(makeClient(CITIES), 'Charlotte, NC');
    expect(id).toBe('city-uuid-charlotte');
  });

  it('throws — does not resolve to undefined/empty — for a display name with no matching city row', async () => {
    await expect(resolveCityId(makeClient(CITIES), 'Nowhere, ZZ')).rejects.toThrow(
      /No city row matches "Nowhere, ZZ"/
    );
  });
});
