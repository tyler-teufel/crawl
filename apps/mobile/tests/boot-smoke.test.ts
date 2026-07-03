import { describe, it, expect, vi, afterEach } from 'vitest';

// The launch crash that stalled the project was a THROW at module-evaluation
// time in the boot chain (_layout → AuthContext → supabase), which fires when
// the bundle first runs — something `expo export` (which bundles but does not
// execute app code) cannot catch. These tests execute the risky boot-chain
// modules with native leaves mocked, asserting they load without throwing.

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));
vi.mock('@sentry/react-native', () => ({
  init: vi.fn(),
  wrap: (component: unknown) => component,
  captureException: vi.fn(),
  mobileReplayIntegration: vi.fn(() => ({})),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('boot smoke: boot-chain modules must not throw at load', () => {
  it('supabase.ts loads without throwing when Supabase env is missing', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');
    vi.resetModules();
    const mod = await import('@/lib/supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeDefined();
  });

  it('supabase.ts reports configured when env is present', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'k');
    vi.resetModules();
    const mod = await import('@/lib/supabase');
    expect(mod.isSupabaseConfigured).toBe(true);
  });

  it('sentry.ts loads and self-initializes without throwing (no DSN)', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', '');
    vi.resetModules();
    const mod = await import('@/lib/sentry');
    expect(mod.Sentry).toBeDefined();
  });
});
