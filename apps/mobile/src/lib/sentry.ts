import * as Sentry from '@sentry/react-native';

// Sample rates tuned for Sentry's free-tier quotas (5K errors, 10K perf
// units, 50 replays per month, org-wide). Errors are always captured;
// traces sampled at 10%; session replays only on errors.
const TRACES_SAMPLE_RATE = 0.1;
const REPLAYS_SESSION_SAMPLE_RATE = 0;
const REPLAYS_ON_ERROR_SAMPLE_RATE = 1.0;

let initialized = false;

export function initSentry() {
  if (initialized) return;

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
  initialized = true;
}

// Initialize on import (not via a later statement). ES import bindings are
// evaluated top-to-bottom before the importing module's body runs, so a
// module that imports this one FIRST gets Sentry's global error handlers
// installed before any other module evaluates. That is what lets Sentry
// capture crashes thrown during initial bundle evaluation — the exact class
// of failure that previously took down the app at launch with no report.
initSentry();

export { Sentry };
