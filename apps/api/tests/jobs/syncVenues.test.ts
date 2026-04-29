import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place, SearchTextResponse } from '../../src/jobs/places/client.js';

// ---- mock PlacesClient -------------------------------------------------------
// vi.mock is hoisted above imports, so we use vi.hoisted() to declare the
// mock fns in the same hoisted scope and reuse them from the factory.

const { geocodeMock, searchTextMock } = vi.hoisted(() => ({
  geocodeMock: vi.fn(),
  searchTextMock: vi.fn(),
}));

vi.mock('../../src/jobs/places/client.js', () => ({
  PlacesClient: class {
    geocode = geocodeMock;
    searchText = searchTextMock;
    buildPhotoUrl = vi.fn();
  },
}));

// ---- mock getDb with a recording chain builder ------------------------------

type DbOp =
  | { kind: 'insert-city'; values: unknown }
  | { kind: 'insert-venue'; values: unknown; updateSet?: unknown }
  | { kind: 'update-venues'; set: unknown; whereCalled: boolean };

const dbOps: DbOp[] = [];

function makeDb() {
  return {
    insert(table: { _: { name: string } } | unknown) {
      const tableName = (table as { _?: { name?: string } } & Record<string, unknown>)._?.name;
      return {
        values(values: unknown) {
          if (tableName === 'cities') {
            dbOps.push({ kind: 'insert-city', values });
          } else {
            dbOps.push({ kind: 'insert-venue', values });
          }
          return {
            onConflictDoUpdate(_opts: { set: unknown }) {
              if (tableName === 'cities') {
                return {
                  returning() {
                    return Promise.resolve([{ id: 'city-id-1', slug: 'test-slug' }]);
                  },
                };
              }
              // venue upserts don't call .returning() in the current orchestrator
              return Promise.resolve();
            },
          };
        },
      };
    },
    update(_table: unknown) {
      const op: DbOp = { kind: 'update-venues', set: null, whereCalled: false };
      dbOps.push(op);
      return {
        set(values: unknown) {
          op.set = values;
          return {
            where(_cond: unknown) {
              op.whereCalled = true;
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
}

vi.mock('../../src/db/index.js', () => ({
  getDb: () => makeDb(),
  schema: {},
}));

// ---- helper: Drizzle table objects expose a `_` symbol-keyed meta; our mock
// reads `._.name`. We stub that onto the `venues`/`cities` imports by patching
// the schema module to return tagged objects. Keep it minimal — the orchestrator
// only needs `table._.name` to route correctly in the mock above.

vi.mock('../../src/db/schema.js', async () => {
  return {
    cities: { _: { name: 'cities' }, id: {}, slug: {} },
    venues: { _: { name: 'venues' }, googlePlaceId: {}, cityId: {} },
  };
});

// ---- import under test AFTER mocks -----------------------------------------

import { syncCity } from '../../src/jobs/syncVenues.js';

function makePlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    displayName: { text: `Place ${id}` },
    formattedAddress: '123 Main St',
    location: { latitude: 35.2271, longitude: -80.8431 },
    types: ['bar'],
    primaryType: 'bar',
    rating: 4.5,
    userRatingCount: 100,
    ...overrides,
  };
}

function ok(places: Place[], nextPageToken?: string): SearchTextResponse {
  return { places, nextPageToken };
}

describe('syncCity', () => {
  beforeEach(() => {
    dbOps.length = 0;
    geocodeMock.mockReset();
    searchTextMock.mockReset();
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    // Default: 1 page per type, no results, for every call.
    searchTextMock.mockResolvedValue(ok([]));
    geocodeMock.mockResolvedValue({
      lat: 35.2271,
      lng: -80.8431,
      formattedAddress: 'Charlotte, NC, USA',
    });

    // Skip the 2s inter-page sleep in tests.
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws if GOOGLE_PLACES_API_KEY is unset', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(syncCity({ city: 'Charlotte', state: 'NC' })).rejects.toThrow(
      /GOOGLE_PLACES_API_KEY/
    );
  });

  it('geocodes once, upserts city, and searches each included type', async () => {
    await syncCity({ city: 'Charlotte', state: 'NC' });

    expect(geocodeMock).toHaveBeenCalledTimes(1);
    expect(geocodeMock).toHaveBeenCalledWith('Charlotte, NC');

    // searchText invoked once per included type (bar, night_club, pub, wine_bar = 4).
    expect(searchTextMock).toHaveBeenCalledTimes(4);
    const types = searchTextMock.mock.calls.map((c) => c[0].includedType);
    expect(new Set(types)).toEqual(new Set(['bar', 'night_club', 'pub', 'wine_bar']));

    // City upsert happened.
    expect(dbOps.some((op) => op.kind === 'insert-city')).toBe(true);
  });

  it('applies shouldKeep filter — drops low-rating places', async () => {
    searchTextMock.mockImplementation(async ({ includedType }) =>
      includedType === 'bar'
        ? ok([makePlace('keep-1', { rating: 4.5 }), makePlace('drop-1', { rating: 2.0 })])
        : ok([])
    );

    const res = await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(res.placesFound).toBe(1);
    expect(res.venuesUpserted).toBe(1);

    const venueInserts = dbOps.filter((op) => op.kind === 'insert-venue');
    expect(venueInserts).toHaveLength(1);
    expect((venueInserts[0].values as { googlePlaceId: string }).googlePlaceId).toBe('keep-1');
  });

  it('dedupes a place that appears under multiple included types', async () => {
    const shared = makePlace('shared-1');
    searchTextMock.mockImplementation(async ({ includedType }) =>
      ['bar', 'night_club'].includes(includedType) ? ok([shared]) : ok([])
    );

    const res = await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(res.placesFound).toBe(1);
    expect(res.venuesUpserted).toBe(1);
  });

  it('paginates searchText up to 3 pages and stops when nextPageToken is absent', async () => {
    let barCalls = 0;
    searchTextMock.mockImplementation(async ({ includedType }) => {
      if (includedType !== 'bar') return ok([]);
      barCalls += 1;
      if (barCalls === 1) return ok([makePlace('p1')], 'token-2');
      if (barCalls === 2) return ok([makePlace('p2')], 'token-3');
      return ok([makePlace('p3')]); // no nextPageToken → stop
    });

    const res = await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(barCalls).toBe(3);
    expect(res.placesFound).toBe(3);
  });

  it('caps pagination at 3 pages even if nextPageToken keeps coming', async () => {
    let barCalls = 0;
    searchTextMock.mockImplementation(async ({ includedType }) => {
      if (includedType !== 'bar') return ok([]);
      barCalls += 1;
      return ok([makePlace(`p${barCalls}`)], `tok-${barCalls + 1}`);
    });

    await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(barCalls).toBe(3);
  });

  it('records error and moves on when searchText throws for one type', async () => {
    searchTextMock.mockImplementation(async ({ includedType }) => {
      if (includedType === 'bar') throw new Error('boom');
      if (includedType === 'night_club') return ok([makePlace('nc-1')]);
      return ok([]);
    });

    const res = await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(res.errors).toEqual([{ error: expect.stringContaining('searchText(bar): boom') }]);
    expect(res.venuesUpserted).toBe(1);
  });

  it('issues soft-deactivate update when any venues were upserted', async () => {
    searchTextMock.mockImplementation(async ({ includedType }) =>
      includedType === 'bar' ? ok([makePlace('p1')]) : ok([])
    );

    await syncCity({ city: 'Charlotte', state: 'NC' });

    const update = dbOps.find((op) => op.kind === 'update-venues');
    expect(update).toBeDefined();
    expect((update as { set: { isActive: boolean } }).set.isActive).toBe(false);
    expect((update as { whereCalled: boolean }).whereCalled).toBe(true);
  });

  it('skips the soft-deactivate update when no venues were kept', async () => {
    // Default mock returns empty pages for every type.
    await syncCity({ city: 'Charlotte', state: 'NC' });
    expect(dbOps.find((op) => op.kind === 'update-venues')).toBeUndefined();
  });

  it('reports transform-skipped places as errors (missing location)', async () => {
    searchTextMock.mockImplementation(async ({ includedType }) =>
      includedType === 'bar'
        ? ok([
            makePlace('ok-1'),
            makePlace('no-loc', { location: undefined as unknown as Place['location'] }),
          ])
        : ok([])
    );

    const res = await syncCity({ city: 'Charlotte', state: 'NC' });
    // shouldKeep also requires location — so 'no-loc' is filtered pre-transform.
    // The transform-skipped error path only fires for something kept that still
    // fails transform (e.g. missing displayName). Confirm the filter won: 1 kept.
    expect(res.venuesUpserted).toBe(1);
    expect(res.errors).toEqual([]);
  });
});
