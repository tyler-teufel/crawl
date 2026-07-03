/**
 * Single source of truth for `EXPO_PUBLIC_*` configuration.
 *
 * These values are inlined into the JS bundle by Metro at build time, so they
 * are read once here at module load. This module is deliberately dependency-free
 * and NEVER throws: a missing value degrades to `undefined` and callers branch
 * on the derived flags (`hasApi`, `hasSupabase`). That keeps the app's boot
 * fail-soft — a misconfigured build renders a degraded UI instead of crashing.
 *
 * Config presence is validated in the pipeline, not on the device: the
 * `verify-env` script (run in CI / the release build) reports the matrix so a
 * misconfiguration is a visible build signal rather than a silent runtime gap.
 */

declare const process: { env: Record<string, string | undefined> };

/** Treat empty strings as unset. */
function clean(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

// NOTE: each var MUST be read via static `process.env.EXPO_PUBLIC_*` access.
// Expo/Metro only inlines EXPO_PUBLIC_* values into the bundle for static member
// expressions — dynamic access (`process.env[key]`) is NOT replaced and would
// read as undefined in the built app. The `expo/no-dynamic-env-var` lint rule
// enforces this.
export const env = {
  /** Railway API base, e.g. https://host/api/v1. Unset → app uses mock data. */
  apiUrl: clean(process.env.EXPO_PUBLIC_API_URL),
  /** Supabase project URL (auth provider). */
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  /** Supabase publishable/anon key (non-secret, safe to ship). */
  supabaseKey: clean(process.env.EXPO_PUBLIC_SUPABASE_KEY),
  /** Sentry DSN (semi-public). Unset → crash reporting disabled. */
  sentryDsn: clean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  /** Google OAuth web client ID — the audience Supabase verifies id_tokens against. */
  googleWebClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  /** Google OAuth iOS client ID. */
  googleIosClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
} as const;

/** True when a real API base is configured (routes reads/writes through it). */
export const hasApi = env.apiUrl != null;

/** True when Supabase auth/data is configured. */
export const hasSupabase = env.supabaseUrl != null && env.supabaseKey != null;

/**
 * Keys that must be present for the given delivery mode. Used by the pipeline's
 * env check, NOT by app runtime — the app never blocks on this.
 *
 * - `mock`:     no backend required; the app runs entirely on bundled data.
 * - `supabase`: auth + direct Supabase reads (Supabase-direct mode).
 * - `api`:      full backend via the Railway API (also needs Supabase for auth).
 */
export function missingEnvForMode(mode: 'mock' | 'supabase' | 'api'): string[] {
  const missing: string[] = [];
  const needSupabase = mode === 'supabase' || mode === 'api';
  const needApi = mode === 'api';
  if (needSupabase && !env.supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (needSupabase && !env.supabaseKey) missing.push('EXPO_PUBLIC_SUPABASE_KEY');
  if (needApi && !env.apiUrl) missing.push('EXPO_PUBLIC_API_URL');
  return missing;
}
