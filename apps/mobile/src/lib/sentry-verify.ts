import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { env } from './env';
import { Sentry } from './sentry';

const STORAGE_PREFIX = 'sentry:verified:';

/**
 * Emits a single low-severity "the SDK is live" event per app version.
 *
 * Why this exists: a correctly-wired Sentry project still shows the onboarding
 * "waiting for your first event" screen until it processes one event. Reporting
 * is gated to release builds (`Sentry.init`'s `enabled: !__DEV__`) and the app
 * does not crash on its own, so a healthy staging build would otherwise never
 * send anything and the dashboard would stay stuck in setup state. This
 * heartbeat makes each deployed version prove the delivery path end-to-end. It
 * also localises a misconfigured DSN: if events are landing in the wrong
 * project, this is the event that reveals where they actually go.
 *
 * Fire-and-forget and never throws — observability must not affect boot. Deduped
 * per version via AsyncStorage so it emits at most once per release, not once
 * per launch.
 */
export async function verifySentryDelivery(): Promise<void> {
  if (__DEV__) return; // mirrors Sentry.init's enabled: !__DEV__
  if (!env.sentryDsn) return; // Sentry disabled — nothing to verify

  try {
    const version = Constants.expoConfig?.version ?? 'unknown';
    const key = `${STORAGE_PREFIX}${version}`;
    if (await AsyncStorage.getItem(key)) return;

    Sentry.captureMessage(`[sentry] client verified for v${version}`, 'info');
    await AsyncStorage.setItem(key, new Date().toISOString());
  } catch {
    // Best-effort: a storage or SDK hiccup must never surface to the user.
  }
}
