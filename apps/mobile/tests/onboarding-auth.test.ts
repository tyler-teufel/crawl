import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Imported for its side effect of being the unit under test. Declared here so
// eslint's import/first is satisfied; vi.mock calls below are hoisted above it.
import OnboardingAuth from '../app/(onboarding)/auth';
import {
  readOnboardingFlag,
  readSessionWithTimeout,
  resolveOnboardingGateStatus,
  SESSION_READ_TIMEOUT_MS,
} from '@/lib/onboarding';

// Regression coverage for the onboarding auth screen (ticket #49). The v1.1.0
// reskin touched app/(onboarding)/auth.tsx presentation only; the three auth
// handlers (Apple / Google / anonymous) must behave exactly as before. This
// pins that behavior.
//
// The mobile test suite runs in a `node` environment with no React renderer
// (react-test-renderer / testing-library are not installed), so rendering the
// screen is impractical. Instead we mock `useState` plus every native leaf,
// invoke the component function to obtain its element tree, pull the real
// `onPress` closures off the returned buttons, and drive them directly. This
// exercises the actual handler code paths without adding a rendering paradigm.

const setPending = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const linkApple = vi.hoisted(() => vi.fn());
const linkGoogle = vi.hoisted(() => vi.fn());
const ensureSignedIn = vi.hoisted(() => vi.fn());
const markOnboardingComplete = vi.hoisted(() => vi.fn());
const alert = vi.hoisted(() => vi.fn());
const getItem = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

// Override only `useState` so the component can run outside a React dispatcher;
// everything else (createElement / jsx-runtime) stays real.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => [initial, setPending] };
});

vi.mock('react-native', () => ({
  View: (props: unknown) => props,
  Text: (props: unknown) => props,
  Pressable: (props: unknown) => props,
  ActivityIndicator: (props: unknown) => props,
  Platform: { OS: 'ios' },
  Alert: { alert },
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ replace }) }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ linkApple, linkGoogle }) }));
vi.mock('@/lib/auth', () => ({ ensureSignedIn }));
// Only `markOnboardingComplete` is stubbed here — the onboarding-gate tests
// below (#158, #191) exercise the real `readOnboardingFlag` and
// `readSessionWithTimeout` against a mocked AsyncStorage/Supabase client, so
// the rest of the module's exports stay real.
vi.mock('@/lib/onboarding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding')>();
  return { ...actual, markOnboardingComplete };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem } }));
vi.mock('@/lib/sentry', () => ({ Sentry: { captureException } }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession } } }));

type El = { props?: Record<string, unknown> } | unknown;

/** Walk a returned React element tree, collecting every node. */
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

/** Render the component to an element tree and pull the three onPress handlers. */
function getHandlers() {
  const tree = (OnboardingAuth as unknown as () => El)();
  const nodes = collect(tree).filter(
    (n): n is { props: Record<string, unknown> } =>
      typeof n === 'object' && n !== null && 'props' in n && !!(n as { props?: unknown }).props
  );
  const withPress = nodes.filter((n) => typeof n.props.onPress === 'function');

  const byLabel = (label: string) =>
    withPress.find((n) => n.props.label === label)?.props.onPress as () => Promise<void>;
  // The anonymous button is the only pressable that carries no `label` prop.
  const anon = withPress.find((n) => n.props.label === undefined)?.props
    .onPress as () => Promise<void>;

  return {
    handleApple: byLabel('Continue with Apple'),
    handleGoogle: byLabel('Continue with Google'),
    handleAnonymous: anon,
  };
}

const lastSetPending = () => (setPending.mock.calls.at(-1) as unknown[] | undefined)?.[0];

beforeEach(() => {
  [
    setPending,
    replace,
    linkApple,
    linkGoogle,
    ensureSignedIn,
    markOnboardingComplete,
    alert,
  ].forEach((m) => (m as Mock).mockReset());
  markOnboardingComplete.mockResolvedValue(undefined);
});

describe('onboarding auth handlers — success paths (#49 regression)', () => {
  it('handleApple links Apple, completes onboarding, then routes into (tabs)', async () => {
    linkApple.mockResolvedValue(undefined);

    await getHandlers().handleApple();

    expect(linkApple).toHaveBeenCalledTimes(1);
    expect(markOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
    expect(alert).not.toHaveBeenCalled();
    // pending is set to 'apple' while in flight, then cleared in `finally`.
    expect(setPending).toHaveBeenNthCalledWith(1, 'apple');
    expect(lastSetPending()).toBeNull();
  });

  it('handleGoogle links Google, completes onboarding, then routes into (tabs)', async () => {
    linkGoogle.mockResolvedValue(undefined);

    await getHandlers().handleGoogle();

    expect(linkGoogle).toHaveBeenCalledTimes(1);
    expect(markOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
    expect(alert).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenNthCalledWith(1, 'google');
    expect(lastSetPending()).toBeNull();
  });

  it('handleAnonymous signs in anonymously, completes onboarding, then routes into (tabs)', async () => {
    ensureSignedIn.mockResolvedValue({ id: 'anon-user' });

    await getHandlers().handleAnonymous();

    expect(ensureSignedIn).toHaveBeenCalledTimes(1);
    expect(markOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
    expect(alert).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenNthCalledWith(1, 'anon');
    expect(lastSetPending()).toBeNull();
  });
});

describe('onboarding auth handlers — failure paths (#49 regression)', () => {
  it('handleApple surfaces an Alert and resets pending when linkApple rejects', async () => {
    linkApple.mockRejectedValue(new Error('apple boom'));

    await getHandlers().handleApple();

    expect(alert).toHaveBeenCalledWith('Sign in with Apple failed', 'apple boom');
    expect(markOnboardingComplete).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenNthCalledWith(1, 'apple');
    expect(lastSetPending()).toBeNull();
  });

  it('handleGoogle surfaces an Alert and resets pending when linkGoogle rejects', async () => {
    linkGoogle.mockRejectedValue(new Error('google boom'));

    await getHandlers().handleGoogle();

    expect(alert).toHaveBeenCalledWith('Sign in with Google failed', 'google boom');
    expect(markOnboardingComplete).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenNthCalledWith(1, 'google');
    expect(lastSetPending()).toBeNull();
  });

  it('handleAnonymous surfaces an Alert and resets pending when ensureSignedIn rejects', async () => {
    ensureSignedIn.mockRejectedValue(new Error('anon boom'));

    await getHandlers().handleAnonymous();

    expect(alert).toHaveBeenCalledWith('Could not continue', 'anon boom');
    expect(markOnboardingComplete).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenNthCalledWith(1, 'anon');
    expect(lastSetPending()).toBeNull();
  });
});

// Regression coverage for OnboardingGate's flag-decision logic (#158). Every
// launch was re-showing the onboarding/auth flow because an AsyncStorage read
// failure was silently swallowed into "show onboarding" with no visibility.
// `readOnboardingFlag` is the extracted, gate-testable piece of that decision:
// it wraps `isOnboardingComplete()` and reports failures to Sentry instead of
// hiding them. (The gate's additional "recover via an already-persisted
// Supabase session" fallback lives in app/_layout.tsx and is device-verified
// only — see the PR description.)
describe('readOnboardingFlag — onboarding gate decision logic (#158 regression)', () => {
  beforeEach(() => {
    getItem.mockReset();
    captureException.mockReset();
  });

  it('resolves true when the completion flag is present', async () => {
    getItem.mockResolvedValue('1');

    await expect(readOnboardingFlag()).resolves.toBe(true);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('resolves false when the completion flag is absent', async () => {
    getItem.mockResolvedValue(null);

    await expect(readOnboardingFlag()).resolves.toBe(false);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports to Sentry and falls back to false when the read throws', async () => {
    const err = new Error('AsyncStorage unavailable');
    getItem.mockRejectedValue(err);

    await expect(readOnboardingFlag()).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledWith(err);
  });
});

// Regression coverage for OnboardingGate's combinator (#158 code review):
// the flag read and the "does a returning session exist" read settle
// independently, and `hasReturningSession` starts at a stale `false` default
// until its read resolves. `resolveOnboardingGateStatus` must not let a
// flag-only 'onboarding' verdict escape as a real redirect while the slower
// session read (which can involve a network token refresh) is still pending
// — otherwise a returning user can get redirected into onboarding by a
// `<Redirect>`, which is one-shot and can't be undone by a later re-render.
describe('resolveOnboardingGateStatus — combining the flag and session reads (#158 regression)', () => {
  it('stays loading (does not redirect) when the flag says onboarding but the session read is still pending', () => {
    expect(resolveOnboardingGateStatus('onboarding', 'loading', false)).toBe('loading');
  });

  it('redirects to onboarding once both reads have settled and no returning session was found', () => {
    expect(resolveOnboardingGateStatus('onboarding', 'done', false)).toBe('onboarding');
  });

  it('resolves done once both reads have settled and a returning session was found', () => {
    expect(resolveOnboardingGateStatus('onboarding', 'done', true)).toBe('done');
  });

  it('resolves done from the flag alone once both reads have settled, no session required', () => {
    expect(resolveOnboardingGateStatus('done', 'done', false)).toBe('done');
  });
});

// Regression coverage for OnboardingGate's session-read timeout (#191).
// `getSession()` can trigger a network token refresh with no built-in
// timeout — a stalled request (bad connectivity, a Supabase incident, a
// captive-portal wifi) previously held the gate in 'loading' forever with no
// way for the user to proceed. `readSessionWithTimeout` races the read
// against `SESSION_READ_TIMEOUT_MS` and treats expiry as "no returning
// session found", falling through to the flag's answer instead of hanging.
describe('readSessionWithTimeout — OnboardingGate session-read timeout (#191 regression)', () => {
  beforeEach(() => {
    getSession.mockReset();
    captureException.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not hang past SESSION_READ_TIMEOUT_MS when getSession() never resolves, and reports to Sentry', async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {})); // stalled forever, like a dead network request

    const result = readSessionWithTimeout();
    await vi.advanceTimersByTimeAsync(SESSION_READ_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('reports to Sentry and resolves false when getSession() rejects', async () => {
    const err = new Error('network down');
    getSession.mockRejectedValue(err);

    await expect(readSessionWithTimeout()).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it('resolves true when a returning session exists and does not report to Sentry', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    await expect(readSessionWithTimeout()).resolves.toBe(true);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('resolves false when no session exists and does not report to Sentry', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(readSessionWithTimeout()).resolves.toBe(false);
    expect(captureException).not.toHaveBeenCalled();
  });
});
