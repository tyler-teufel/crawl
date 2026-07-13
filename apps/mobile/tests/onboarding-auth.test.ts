import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Imported for its side effect of being the unit under test. Declared here so
// eslint's import/first is satisfied; vi.mock calls below are hoisted above it.
import OnboardingAuth from '../app/(onboarding)/auth';

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
vi.mock('@/lib/onboarding', () => ({ markOnboardingComplete }));

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
