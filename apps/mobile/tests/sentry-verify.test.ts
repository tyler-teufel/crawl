import { describe, it, expect, vi, afterEach } from 'vitest';

// verifySentryDelivery() is the heartbeat that takes the Sentry project out of
// its "waiting for first event" onboarding state on a healthy release build.
// These tests pin its contract: emit once per version when a DSN is set, stay
// silent otherwise, dedupe across launches, and never throw into the boot path.
// (`__DEV__` is stubbed false in tests/setup.ts, so the delivery path runs.)

const { captureMessage, getItem, setItem } = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@/lib/sentry', () => ({ Sentry: { captureMessage } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem, setItem },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '9.9.9' } } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

async function load() {
  vi.resetModules();
  return import('@/lib/sentry-verify');
}

const DSN = 'https://k@o1.ingest.sentry.io/1';

describe('verifySentryDelivery', () => {
  it('no-ops when no DSN is configured', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', '');
    const { verifySentryDelivery } = await load();
    await verifySentryDelivery();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('emits one verification event, tagged with the version, when a DSN is set', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', DSN);
    getItem.mockResolvedValue(null);
    const { verifySentryDelivery } = await load();
    await verifySentryDelivery();
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('9.9.9'), 'info');
    expect(setItem).toHaveBeenCalledWith('sentry:verified:9.9.9', expect.any(String));
  });

  it('does not re-emit once the version is already verified', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', DSN);
    getItem.mockResolvedValue('2026-07-09T00:00:00.000Z');
    const { verifySentryDelivery } = await load();
    await verifySentryDelivery();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('never throws if storage or the SDK misbehaves', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', DSN);
    getItem.mockRejectedValue(new Error('storage down'));
    const { verifySentryDelivery } = await load();
    await expect(verifySentryDelivery()).resolves.toBeUndefined();
  });
});
