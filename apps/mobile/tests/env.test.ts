import { describe, it, expect, vi, afterEach } from 'vitest';

// env.ts reads process.env once at module load, so each case resets modules and
// re-imports after stubbing the environment.
async function loadEnv() {
  vi.resetModules();
  return import('@/lib/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env', () => {
  it('flags everything unset when EXPO_PUBLIC_* are absent', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');
    const { env, hasApi, hasSupabase } = await loadEnv();
    expect(hasApi).toBe(false);
    expect(hasSupabase).toBe(false);
    expect(env.apiUrl).toBeUndefined();
  });

  it('treats empty strings as unset', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'k');
    const { hasSupabase } = await loadEnv();
    expect(hasSupabase).toBe(false);
  });

  it('flags configured when supabase + api are present', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://host/api/v1');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'k');
    const { env, hasApi, hasSupabase } = await loadEnv();
    expect(hasApi).toBe(true);
    expect(hasSupabase).toBe(true);
    expect(env.apiUrl).toBe('https://host/api/v1');
  });

  it('missingEnvForMode reports required keys per mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');
    const { missingEnvForMode } = await loadEnv();
    expect(missingEnvForMode('mock')).toEqual([]);
    expect(missingEnvForMode('supabase')).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_KEY',
    ]);
    expect(missingEnvForMode('api')).toContain('EXPO_PUBLIC_API_URL');
  });
});
