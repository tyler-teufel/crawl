import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Regression tests for #126: the `cast_vote` Postgres RPC
// (apps/api/drizzle/0007_cast_vote_rpc.sql) enforces the 3/day cap and
// per-venue dedup on the Supabase-direct write path, which previously had no
// implementation at all (useCastVote's mutationFn only branched on hasApi,
// so a Supabase-only build silently fell through to the mock layer). These
// tests exercise useCastVote/useRemoveVote's mutationFn directly across all
// three data-source tiers, the same way tests/trending.test.ts covers
// useTrending's tier selection (#150) — `useMutation`/`useQuery` are mocked
// to return their options object so `mutationFn`/`queryFn` can be invoked
// without rendering a component.

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => opts,
  useMutation: (opts: any) => opts,
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

// votes.ts imports venueKeys from ./venues, which imports queryClient from
// ./query-client — a real `new QueryClient()`. Stub it (same as
// tests/trending.test.ts) so the `useQuery`/`useMutation` mock above doesn't
// also need to satisfy `@tanstack/react-query`'s `QueryClient` export.
vi.mock('@/api/query-client', () => ({ queryClient: {} }));

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

function stubTier(opts: { api?: string; supabaseUrl?: string; supabaseKey?: string }) {
  vi.stubEnv('EXPO_PUBLIC_API_URL', opts.api ?? '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', opts.supabaseUrl ?? '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', opts.supabaseKey ?? '');
}

async function loadVotes() {
  vi.resetModules();
  return import('@/api/votes');
}

beforeEach(() => {
  storage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

const SUPABASE_TIER = { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' };

describe('useCastVote mutationFn — Supabase tier (RPC contract)', () => {
  it("calls supabase.rpc('cast_vote', { p_venue_id }) and returns the RPC-shaped VoteState on success", async () => {
    stubTier(SUPABASE_TIER);
    const rpcState = {
      remainingVotes: 2,
      maxVotes: 3,
      votedVenueIds: ['v1'],
      resetAt: '2026-07-31T08:00:00.000Z',
    };
    supabaseMock.rpc.mockResolvedValue({ data: rpcState, error: null });

    const { useCastVote } = await loadVotes();
    const result = await (useCastVote('Charlotte, NC') as any).mutationFn('v1');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('cast_vote', { p_venue_id: 'v1' });
    expect(result).toEqual(rpcState);
  });

  it('rejects a 4th cast with NO_VOTES_REMAINING, matching the RPC error contract exactly', async () => {
    stubTier(SUPABASE_TIER);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'NO_VOTES_REMAINING' },
    });

    const { useCastVote, VoteError } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    await expect(mutationFn('v4')).rejects.toThrow(VoteError);
    await expect(mutationFn('v4')).rejects.toMatchObject({ code: 'NO_VOTES_REMAINING' });
  });

  it('rejects a duplicate cast with ALREADY_VOTED, matching the RPC error contract exactly', async () => {
    stubTier(SUPABASE_TIER);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_VOTED' },
    });

    const { useCastVote, VoteError } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    await expect(mutationFn('v1')).rejects.toThrow(VoteError);
    await expect(mutationFn('v1')).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
  });

  it('matches on exact error.message equality, not a substring, so an unrecognized message is rethrown as-is', async () => {
    stubTier(SUPABASE_TIER);
    const dbError = { message: 'permission denied for function cast_vote' };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: dbError });

    const { useCastVote } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    await expect(mutationFn('v1')).rejects.toEqual(dbError);
  });
});

describe('useCastVote mutationFn — mock tier (no backend configured)', () => {
  it('a successful cast decrements remainingVotes and records the venue', async () => {
    stubTier({});
    const { useCastVote } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    const result = await mutationFn('v1');

    expect(result.remainingVotes).toBe(2);
    expect(result.votedVenueIds).toEqual(['v1']);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects a 4th cast with NO_VOTES_REMAINING, the same code the Supabase tier throws', async () => {
    stubTier({});
    const { useCastVote, VoteError } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    await mutationFn('v1');
    await mutationFn('v2');
    await mutationFn('v3');

    await expect(mutationFn('v4')).rejects.toThrow(VoteError);
    await expect(mutationFn('v4')).rejects.toMatchObject({ code: 'NO_VOTES_REMAINING' });
  });

  it('rejects a duplicate cast with ALREADY_VOTED, the same code the Supabase tier throws', async () => {
    stubTier({});
    const { useCastVote, VoteError } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;

    await mutationFn('v1');

    await expect(mutationFn('v1')).rejects.toThrow(VoteError);
    await expect(mutationFn('v1')).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
  });
});

describe('useCastVote mutationFn — Railway API tier takes precedence over Supabase', () => {
  it('calls the Railway API and never the Supabase RPC when both are configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ remainingVotes: 2 }) }))
    );
    stubTier({ api: 'https://api.example.com/api/v1', ...SUPABASE_TIER });

    const { useCastVote } = await loadVotes();
    const mutationFn = (useCastVote('Charlotte, NC') as any).mutationFn;
    await mutationFn('v1');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('useRemoveVote mutationFn — no Supabase RPC exists for vote removal (#126)', () => {
  it('falls through to the mock implementation when only Supabase is configured, rather than hitting Supabase directly', async () => {
    // Seed persisted state (the AsyncStorage mock, shared across module
    // reloads) with an existing vote, as if a prior mock-tier cast happened.
    const { castMockVote } = await loadVotes();
    await castMockVote('v1');

    stubTier(SUPABASE_TIER);
    const { useRemoveVote } = await loadVotes();
    const result = await (useRemoveVote('Charlotte, NC') as any).mutationFn('v1');

    expect(result.votedVenueIds).toEqual([]);
    expect(result.remainingVotes).toBe(3);
    // The removal itself never touched Supabase — no RPC exists, and RLS
    // blocks a direct DELETE on `votes` for `authenticated` (see the
    // mutationFn comment in src/api/votes.ts).
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
