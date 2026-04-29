import * as Sentry from '@sentry/react-native';

// Sample rates tuned for Sentry's free-tier quotas (5K errors, 10K perf
// units, 50 replays per month, org-wide). Errors are always captured;
// traces sampled at 10%; session replays only on errors.
const TRACES_SAMPLE_RATE = 0.1;
const REPLAYS_SESSION_SAMPLE_RATE = 0;
const REPLAYS_ON_ERROR_SAMPLE_RATE = 1.0;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled');
    }
    return;
  }

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: REPLAYS_ON_ERROR_SAMPLE_RATE,
    integrations: [Sentry.mobileReplayIntegration()],
  });
}

export { Sentry };
