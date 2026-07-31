import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sentry } from './sentry';
import { supabase } from './supabase';

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
 * `getSession()` can trigger a network token refresh, which has no built-in
 * timeout — a stalled request (bad connectivity, a Supabase incident, a
 * captive-portal wifi) would otherwise hold OnboardingGate in 'loading'
 * forever with no way for the user to proceed (#191). `readSessionWithTimeout`
 * races the read against `SESSION_READ_TIMEOUT_MS` and treats expiry as "no
 * returning session found", falling through to the flag's answer — the same
 * degraded-but-recoverable behavior as the pre-#158 code. Both the timeout
 * and a thrown read error are reported to Sentry, consistent with
 * `readOnboardingFlag`'s own failure reporting above.
 */
export const SESSION_READ_TIMEOUT_MS = 5000;

export async function readSessionWithTimeout(): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<'timed-out'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timed-out'), SESSION_READ_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data: { session } }) => !!session?.user),
      timedOut,
    ]);
    if (result === 'timed-out') {
      Sentry.captureException(
        new Error(`OnboardingGate: getSession() timed out after ${SESSION_READ_TIMEOUT_MS}ms`)
      );
      return false;
    }
    return result;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  } finally {
    clearTimeout(timeoutId!);
  }
}
