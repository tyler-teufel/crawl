import { describe, it, expect, vi, afterEach } from 'vitest';

// Pins the claim behind #150's fix: "the venue list, trending, and venue
// detail Supabase reads all use the shared column list and row mapping from
// src/api/venueRow.ts" — as opposed to each call site re-declaring its own
// column string / mapping function that merely happens to produce the same
// shape (which is exactly the drift that let the trending hook diverge from
// the venue list hook before #150).
//
// Unlike tests/venues.test.ts and tests/trending.test.ts (which assert on
// final Venue shape and would pass even if each file duplicated an identical
// mapping locally), this file mocks '@/api/venueRow' itself so the assertions
// only pass if venues.ts / trending.ts actually import and call the real
// exports rather than reimplementing them.

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
const resolveCityIdMock = vi.hoisted(() => vi.fn(async () => 'city-uuid-charlotte'));
const MARKER_COLUMNS = vi.hoisted(() => '__shared_venue_columns_marker__');
const rowToVenueMock = vi.hoisted(() => vi.fn((row: any) => ({ id: row.id, from: 'rowToVenue' })));
const rowsToVenuesMock = vi.hoisted(() =>
  vi.fn((rows: any[]) => rows.map((r) => ({ id: r.id, from: 'rowsToVenues' })))
);

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (opts: any) => opts }));
vi.mock('@/api/cities', () => ({ resolveCityId: resolveCityIdMock }));
vi.mock('@/api/query-client', () => ({ queryClient: {} }));
vi.mock('@/api/venueRow', () => ({
  VENUE_COLUMNS: MARKER_COLUMNS,
  rowToVenue: rowToVenueMock,
  rowsToVenues: rowsToVenuesMock,
}));

/** A chainable, thenable stand-in for the supabase-js query builder. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function stubSupabaseTier() {
  vi.stubEnv('EXPO_PUBLIC_API_URL', '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'k');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

const ROW = { id: 'v-1', name: 'Merchant & Trade' };

describe('shared venueRow module usage (#150)', () => {
  it('useVenues (list) selects the shared VENUE_COLUMNS and maps rows via the shared rowsToVenues', async () => {
    stubSupabaseTier();
    const builder = makeBuilder({ data: [ROW], error: null });
    supabaseMock.from.mockReturnValue(builder);
    vi.resetModules();
    const { useVenues } = await import('@/api/venues');

    const result = await (useVenues('Charlotte, NC', []) as any).queryFn();

    expect(builder.select).toHaveBeenCalledWith(MARKER_COLUMNS);
    expect(rowsToVenuesMock).toHaveBeenCalledWith([ROW]);
    // Delegated, not reimplemented: the result carries the mock's fingerprint.
    expect(result).toEqual([{ id: 'v-1', from: 'rowsToVenues' }]);
  });

  it('useVenue (detail) selects the shared VENUE_COLUMNS and maps its row via the shared rowToVenue', async () => {
    stubSupabaseTier();
    const builder = makeBuilder({ data: ROW, error: null });
    supabaseMock.from.mockReturnValue(builder);
    vi.resetModules();
    const { useVenue } = await import('@/api/venues');

    const result = await (useVenue('v-1') as any).queryFn();

    expect(builder.select).toHaveBeenCalledWith(MARKER_COLUMNS);
    expect(rowToVenueMock).toHaveBeenCalledWith(ROW);
    expect(result).toEqual({ id: 'v-1', from: 'rowToVenue' });
  });

  it('useTrending selects the shared VENUE_COLUMNS and maps rows via the shared rowsToVenues', async () => {
    stubSupabaseTier();
    const builder = makeBuilder({ data: [ROW], error: null });
    supabaseMock.from.mockReturnValue(builder);
    vi.resetModules();
    const { useTrending } = await import('@/api/trending');

    const result = await (useTrending('Charlotte, NC') as any).queryFn();

    expect(builder.select).toHaveBeenCalledWith(MARKER_COLUMNS);
    expect(rowsToVenuesMock).toHaveBeenCalledWith([ROW]);
    expect(result).toEqual([{ id: 'v-1', from: 'rowsToVenues' }]);
  });
});
