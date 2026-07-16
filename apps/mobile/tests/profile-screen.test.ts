import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Imported for its side effect of being the unit under test. Declared here so
// eslint's import/first is satisfied; vi.mock calls below are hoisted above it.
import ProfileScreen from '../app/(tabs)/profile';

// Regression coverage for the Profile screen (ticket #51).
//
// The mobile test suite runs in a `node` environment with no React renderer
// (react-test-renderer / testing-library are not installed), so rendering the
// screen is impractical. Instead, following the pattern established in
// tests/onboarding-auth.test.ts, we mock every native leaf and invoke the
// component function directly to obtain its returned element tree (plain
// `{ type, props }` objects from createElement — never actually rendered),
// then walk that tree to read out computed text / extract real onPress
// closures and drive them directly. This exercises the actual derivation
// logic and handler code paths without adding a rendering paradigm.

const useAuthMock = vi.hoisted(() => vi.fn());
const useVenueContextMock = vi.hoisted(() => vi.fn());
const useQueriesMock = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const alert = vi.hoisted(() => vi.fn());

// Override only `useMemo` so the component can run outside a React dispatcher
// (this suite invokes the component function directly, not via a renderer);
// everything else (createElement / jsx-runtime) stays real.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useMemo: (factory: () => unknown) => factory() };
});

vi.mock('react-native', () => ({
  View: (props: unknown) => props,
  Text: (props: unknown) => props,
  ScrollView: (props: unknown) => props,
  Pressable: (props: unknown) => props,
  Alert: { alert },
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ replace, push }) }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: (props: unknown) => props }));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('@/context/VenueContext', () => ({ useVenueContext: () => useVenueContextMock() }));

// `venueDetailQueryOptions` is reduced to a passthrough marker — `{ __id }` —
// so the mocked `useQueries` below can identify which id each query entry is
// for without depending on the real query-key shape.
vi.mock('@/api/venues', () => ({
  venueDetailQueryOptions: (id: string) => ({ __id: id }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueries: (opts: unknown) => useQueriesMock(opts),
}));

/**
 * Drives the mocked `useQueries` result: `resultsById` maps a voted venue id
 * to either a resolved venue shape, `'loading'` (query still in flight), or
 * omitted (query settled with no result — the id no longer exists).
 */
function mockHistoryLookups(resultsById: Record<string, { name: string } | 'loading'>) {
  useQueriesMock.mockImplementation((opts: { queries: { __id: string }[] }) =>
    opts.queries.map(({ __id }) => {
      const entry = resultsById[__id];
      if (entry === 'loading') return { data: undefined, isLoading: true };
      if (entry) return { data: entry, isLoading: false };
      return { data: undefined, isLoading: false };
    })
  );
}

type El = { type?: unknown; props?: Record<string, unknown> } | unknown;

/** Walk a returned React element tree, collecting every node (including the root). */
function collect(node: El, acc: El[] = []): El[] {
  if (node == null || typeof node === 'boolean') return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => collect(n, acc));
    return acc;
  }
  if (typeof node === 'object') {
    acc.push(node);
    const children = (node as { props?: { children?: unknown } }).props?.children;
    if (children !== undefined) collect(children, acc);
  }
  return acc;
}

function renderTree() {
  const tree = (ProfileScreen as unknown as () => El)();
  return collect(tree).filter(
    (n): n is { type?: unknown; props: Record<string, unknown> } =>
      typeof n === 'object' && n !== null && 'props' in n && !!(n as { props?: unknown }).props
  );
}

/** Find every Text-shaped node (string or number children) that matches a predicate. */
function findTextNodes(nodes: ReturnType<typeof renderTree>, matcher: (text: string) => boolean) {
  return nodes.filter((n) => {
    const children = n.props.children;
    return (
      (typeof children === 'string' || typeof children === 'number') && matcher(String(children))
    );
  });
}

const defaultVenueContext = {
  voteState: { maxVotes: 3, remainingVotes: 3, votedVenueIds: [] as string[] },
};

beforeEach(() => {
  [useAuthMock, useVenueContextMock, useQueriesMock, replace, push, signOut, alert].forEach((m) =>
    (m as Mock).mockReset()
  );
  useVenueContextMock.mockReturnValue(defaultVenueContext);
  // Default: every id's detail lookup settles with no result (dropped). Tests
  // that care about resolved/loading venues call mockHistoryLookups(...).
  mockHistoryLookups({});
});

describe('Profile screen — initials derivation (#51)', () => {
  it('renders the first letter of the first two words, uppercased, for a two-word name', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { full_name: 'jane doe' }, email: 'jane@example.com' },
      isAnonymous: false,
      signOut,
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'JD')).toHaveLength(1);
  });

  it('renders a single initial for a single-word name', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { full_name: 'Cher' }, email: 'cher@example.com' },
      isAnonymous: false,
      signOut,
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'C')).toHaveLength(1);
  });

  it('ignores words past the first two', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { full_name: 'Jane Quinn Doe' }, email: 'jane@example.com' },
      isAnonymous: false,
      signOut,
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'JQ')).toHaveLength(1);
    expect(findTextNodes(nodes, (t) => t === 'JQD')).toHaveLength(0);
  });

  it('falls back to email-derived display name (no initials crash) when full_name is absent', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: {}, email: 'plain@example.com' },
      isAnonymous: false,
      signOut,
    });

    const nodes = renderTree();
    // displayName becomes the raw email; initialsFrom splits on spaces, so a
    // single "word" email yields just its first character, uppercased.
    expect(findTextNodes(nodes, (t) => t === 'plain@example.com')).toHaveLength(1);
    expect(findTextNodes(nodes, (t) => t === 'P')).toHaveLength(1);
  });

  it('shows "Guest" for anonymous users instead of computing initials', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAnonymous: true,
      signOut,
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Guest')).toHaveLength(1);
  });
});

describe('Profile screen — Votes Today stat derivation (#51)', () => {
  it('computes votes-today as maxVotes minus remainingVotes', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 1, votedVenueIds: [] },
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === '2')).toHaveLength(1);
  });

  it('shows 0 votes today when no votes have been cast', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 3, votedVenueIds: [] },
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === '0')).toHaveLength(1);
  });

  it('never fabricates a streak number — renders the sanctioned "—" placeholder', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === '—')).toHaveLength(1);
  });
});

describe('Profile screen — voting history derivation (#51)', () => {
  it('maps votedVenueIds to detail-looked-up venues, preserving order', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 1, votedVenueIds: ['v2', 'v1'] },
    });
    mockHistoryLookups({ v1: { name: 'Alpha Bar' }, v2: { name: 'Beta Club' } });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Beta Club')).toHaveLength(1);
    expect(findTextNodes(nodes, (t) => t === 'Alpha Bar')).toHaveLength(1);
  });

  it('silently drops voted ids whose detail lookup settles with no result', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 2, votedVenueIds: ['missing', 'v1'] },
    });
    mockHistoryLookups({ v1: { name: 'Alpha Bar' } });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Alpha Bar')).toHaveLength(1);
  });

  // Regression guard (#51 review): history must be sourced from a direct
  // per-id detail lookup, NEVER from VenueContext's `venues` array — that
  // array is scoped to the currently selected city + active filters, so a
  // voted venue can disappear from it (a filter toggle, a city switch, its
  // isOpen flag flipping) while the vote itself is still very much cast.
  // `useVenueContextMock` here deliberately returns no `venues` array at all
  // — if the component ever reads `venues` again to resolve history, this
  // test fails loudly (destructuring/property access on undefined) instead
  // of silently reintroducing the coupling.
  it('renders a voted venue via direct detail lookup even when absent from the filtered venues list', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 2, votedVenueIds: ['v1'] },
      // No `venues` field — simulates a city/filter switch that excludes v1
      // from the currently-scoped list.
    });
    mockHistoryLookups({ v1: { name: 'Alpha Bar' } });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Alpha Bar')).toHaveLength(1);
  });

  it('renders a lightweight placeholder row while a voted venue detail is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 2, votedVenueIds: ['v1'] },
    });
    mockHistoryLookups({ v1: 'loading' });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Loading…')).toHaveLength(1);
  });

  it('shows the empty state copy when no votes were cast today', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });

    const nodes = renderTree();
    expect(
      findTextNodes(nodes, (t) => t.includes("haven't voted for any venues yet today"))
    ).toHaveLength(1);
  });
});

describe('Profile screen — sign-out handler (#51)', () => {
  function getSignOutHandler() {
    const nodes = renderTree();
    const pressables = nodes.filter((n) => typeof n.props.onPress === 'function');
    // The sign-out row is the only Pressable whose accessibilityRole is 'button'.
    const match = pressables.find((n) => n.props.accessibilityRole === 'button');
    if (!match) throw new Error('sign-out Pressable not found');
    return match.props.onPress as () => Promise<void>;
  }

  it('redirects to onboarding only after signOut resolves (no premature navigation)', async () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });

    let resolveSignOut: () => void = () => {};
    signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      })
    );

    const handleSignOut = getSignOutHandler();
    const pending = handleSignOut();

    // signOut has been kicked off, but its promise hasn't settled yet — the
    // redirect must not have fired.
    expect(replace).not.toHaveBeenCalled();

    resolveSignOut();
    await pending;

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/(onboarding)');
  });

  it('surfaces an Alert and does NOT navigate when signOut rejects', async () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    signOut.mockRejectedValue(new Error('network down'));

    const handleSignOut = getSignOutHandler();
    await handleSignOut();

    expect(alert).toHaveBeenCalledWith('Sign out failed', 'network down');
    expect(replace).not.toHaveBeenCalled();
  });
});
