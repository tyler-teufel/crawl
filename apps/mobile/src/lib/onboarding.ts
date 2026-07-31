import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sentry } from './sentry';

const FIRST_LAUNCH_KEY = 'crawl.firstLaunchComplete.v1';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
  return value === '1';
}

/**
 * Wraps isOnboardingComplete() for OnboardingGate. A read failure here used
 * to be swallowed silently into "show onboarding" (#158) — report it to
 * Sentry so a systemic AsyncStorage failure is visible, then fall back to
 * `false`, still the safe default for a read we can't trust.
 */
export async function readOnboardingFlag(): Promise<boolean> {
  try {
    return await isOnboardingComplete();
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

export type OnboardingGateStatus = 'loading' | 'onboarding' | 'done';

/** Where OnboardingGate should redirect, or null to leave routing alone. */
export type OnboardingRedirect = '/(onboarding)' | '/(tabs)' | null;

/**
 * OnboardingGate's routing decision. Both directions matter: `/` is claimed by
 * two index routes ((onboarding) and (tabs)), and expo-router resolves that
 * ambiguity in (onboarding)'s favor — so every cold start lands on the welcome
 * screen. Redirecting only INTO onboarding, as the gate did before, left a
 * user who had already finished it stranded on the sign-in flow on every
 * launch with no way back other than re-running it.
 */
export function resolveOnboardingRedirect(
  status: OnboardingGateStatus,
  inOnboardingGroup: boolean
): OnboardingRedirect {
  if (status === 'loading') return null;
  if (status === 'onboarding') return inOnboardingGroup ? null : '/(onboarding)';
  return inOnboardingGroup ? '/(tabs)' : null;
}

/**
 * OnboardingGate's decision logic (#158): the flag and "does a returning
 * Supabase session already exist" are two independent async reads that
 * settle at different times — the session read can itself trigger a network
 * token refresh, so it is frequently slower than the flag's single local
 * AsyncStorage read. Resolving 'loading' until BOTH have settled, rather
 * than just the flag, is what stops the gate from redirecting into
 * onboarding on `hasReturningSession`'s stale `false` default while that
 * slower session read is still in flight.
 */
export function resolveOnboardingGateStatus(
  flagStatus: OnboardingGateStatus,
  sessionStatus: 'loading' | 'done',
  hasReturningSession: boolean
): OnboardingGateStatus {
  if (flagStatus === 'loading' || sessionStatus === 'loading') return 'loading';
  if (flagStatus === 'done' || hasReturningSession) return 'done';
  return 'onboarding';
}

const listeners = new Set<() => void>();

// Subscribers are notified after markOnboardingComplete writes to
// AsyncStorage. The OnboardingGate uses this to re-read the flag without
// having to poll on every render.
export function subscribeToOnboardingStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
  listeners.forEach((listener) => listener());
}

/**
 * Clears the first-launch flag. Called on sign-out: without it the flag would
 * still read 'done' and the gate (which now redirects completed users out of
 * the onboarding group) would bounce the just-signed-out user straight back
 * into the tabs they no longer have a session for.
 */
export async function clearOnboardingFlag(): Promise<void> {
  await AsyncStorage.removeItem(FIRST_LAUNCH_KEY);
  listeners.forEach((listener) => listener());
}
