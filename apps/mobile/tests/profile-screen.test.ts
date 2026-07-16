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
const replace = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const alert = vi.hoisted(() => vi.fn());

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

function getVenue(id: string, name: string) {
  return { id, name } as unknown as import('@/types/venue').Venue;
}

const defaultVenueContext = {
  voteState: { maxVotes: 3, remainingVotes: 3, votedVenueIds: [] as string[] },
  venues: [] as ReturnType<typeof getVenue>[],
};

beforeEach(() => {
  [useAuthMock, useVenueContextMock, replace, push, signOut, alert].forEach((m) =>
    (m as Mock).mockReset()
  );
  useVenueContextMock.mockReturnValue(defaultVenueContext);
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
      venues: [],
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === '2')).toHaveLength(1);
  });

  it('shows 0 votes today when no votes have been cast', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 3, votedVenueIds: [] },
      venues: [],
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
  it('maps votedVenueIds to venues in the same city/session state, preserving order', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 1, votedVenueIds: ['v2', 'v1'] },
      venues: [getVenue('v1', 'Alpha Bar'), getVenue('v2', 'Beta Club')],
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Beta Club')).toHaveLength(1);
    expect(findTextNodes(nodes, (t) => t === 'Alpha Bar')).toHaveLength(1);
  });

  it('silently drops voted ids that no longer resolve to a known venue', () => {
    useAuthMock.mockReturnValue({ user: null, isAnonymous: true, signOut });
    useVenueContextMock.mockReturnValue({
      voteState: { maxVotes: 3, remainingVotes: 2, votedVenueIds: ['missing', 'v1'] },
      venues: [getVenue('v1', 'Alpha Bar')],
    });

    const nodes = renderTree();
    expect(findTextNodes(nodes, (t) => t === 'Alpha Bar')).toHaveLength(1);
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
