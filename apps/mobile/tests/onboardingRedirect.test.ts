import { describe, it, expect, vi } from 'vitest';
import { resolveOnboardingRedirect } from '@/lib/onboarding';

// Regression coverage for the v1.1.2 report "sign in still re-prompts every
// time the app is opened". Both `(onboarding)/index` and `(tabs)/index` claim
// the `/` path, and expo-router resolves that ambiguity in (onboarding)'s
// favor — so every cold start renders the welcome screen. OnboardingGate only
// ever redirected INTO onboarding, so an already-onboarded user had no way
// out and re-ran the sign-in flow on every launch.

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/lib/sentry', () => ({ Sentry: { captureException: vi.fn() } }));

describe('resolveOnboardingRedirect', () => {
  it('routes a completed user out of the onboarding group', () => {
    expect(resolveOnboardingRedirect('done', true)).toBe('/(tabs)');
  });

  it('leaves a completed user already in the tabs alone', () => {
    expect(resolveOnboardingRedirect('done', false)).toBeNull();
  });

  it('routes an un-onboarded user into the flow', () => {
    expect(resolveOnboardingRedirect('onboarding', false)).toBe('/(onboarding)');
  });

  it('does not bounce a user who is mid-flow', () => {
    expect(resolveOnboardingRedirect('onboarding', true)).toBeNull();
  });

  it('never redirects while the flag/session reads are still settling', () => {
    expect(resolveOnboardingRedirect('loading', true)).toBeNull();
    expect(resolveOnboardingRedirect('loading', false)).toBeNull();
  });
});
