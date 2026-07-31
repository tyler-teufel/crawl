import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression coverage for OnboardingGate's session-read timeout (#191).
// #158 made OnboardingGate wait for both the onboarding flag AND a
// `supabase.auth.getSession()` read before deciding whether to redirect. That
// session read can trigger a network token refresh with no built-in timeout —
// a stalled request left the gate in 'loading' forever with no way for the
// user to proceed. `readSessionWithTimeout` (app/_layout.tsx) races the read
// against `SESSION_READ_TIMEOUT_MS` and treats expiry as "no returning
// session found", falling through to the flag's answer instead of hanging.
//
// app/_layout.tsx pulls in the full navigator boot chain (fonts, Stack,
// providers, etc.); everything below is mocked to a inert stand-in purely so
// the module can be imported to exercise `readSessionWithTimeout`, which has
// no React dependency of its own.

const getSession = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());

vi.mock('../global.css', () => ({}));
vi.mock('react-native', () => ({
  View: (props: unknown) => props,
  Text: (props: unknown) => props,
  Pressable: (props: unknown) => props,
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('expo-router', () => ({
  Stack: Object.assign((props: unknown) => props, { Screen: (props: unknown) => props }),
  Redirect: (props: unknown) => props,
  useSegments: () => [],
}));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('@react-navigation/native', () => ({ ThemeProvider: (props: unknown) => props }));
vi.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark', setColorScheme: vi.fn() }),
}));
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn(() => Promise.resolve()),
  hideAsync: vi.fn(),
}));
vi.mock('@rn-primitives/portal', () => ({ PortalHost: () => null }));
vi.mock('@tanstack/react-query', () => ({ QueryClientProvider: (props: unknown) => props }));
vi.mock('@/api/query-client', () => ({ queryClient: {} }));
vi.mock('@/context/AuthContext', () => ({ AuthProvider: (props: unknown) => props }));
vi.mock('@/context/VenueContext', () => ({ VenueProvider: (props: unknown) => props }));
vi.mock('@/lib/theme', () => ({ NAV_THEME: { dark: {}, light: {} } }));
vi.mock('@/lib/onboarding', () => ({
  readOnboardingFlag: vi.fn(),
  resolveOnboardingGateStatus: vi.fn(),
  subscribeToOnboardingStatus: vi.fn(() => () => {}),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession } } }));
vi.mock('@/lib/sentry-verify', () => ({ verifySentryDelivery: vi.fn() }));
vi.mock('@/lib/sentry', () => ({ Sentry: { wrap: (c: unknown) => c, captureException } }));
vi.mock('../components/ui/OfflineBanner', () => ({ OfflineBanner: () => null }));
vi.mock('../components/layout/AnimatedSplash', () => ({ AnimatedSplash: () => null }));

async function load() {
  return import('../app/_layout');
}

beforeEach(() => {
  getSession.mockReset();
  captureException.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('readSessionWithTimeout — OnboardingGate session-read timeout (#191 regression)', () => {
  it('does not hang past SESSION_READ_TIMEOUT_MS when getSession() never resolves, and reports to Sentry', async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {})); // stalled forever, like a dead network request

    const { readSessionWithTimeout, SESSION_READ_TIMEOUT_MS } = await load();

    const result = readSessionWithTimeout();
    await vi.advanceTimersByTimeAsync(SESSION_READ_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('reports to Sentry and resolves false when getSession() rejects', async () => {
    const err = new Error('network down');
    getSession.mockRejectedValue(err);

    const { readSessionWithTimeout } = await load();

    await expect(readSessionWithTimeout()).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it('resolves true when a returning session exists and does not report to Sentry', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    const { readSessionWithTimeout } = await load();

    await expect(readSessionWithTimeout()).resolves.toBe(true);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('resolves false when no session exists and does not report to Sentry', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const { readSessionWithTimeout } = await load();

    await expect(readSessionWithTimeout()).resolves.toBe(false);
    expect(captureException).not.toHaveBeenCalled();
  });
});
