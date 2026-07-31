// Import Sentry FIRST so its global error handlers are installed before any
// other module below evaluates. This is what allows Sentry to capture crashes
// thrown during initial bundle evaluation (e.g. a throw at module load in the
// auth/data chain) instead of dying silently before init, as happened before.
import { Sentry } from '@/lib/sentry';
import '../global.css';
import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, Redirect, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/query-client';
import { AuthProvider } from '@/context/AuthContext';
import { VenueProvider } from '@/context/VenueContext';
import { NAV_THEME } from '@/lib/theme';
import {
  readOnboardingFlag,
  resolveOnboardingGateStatus,
  subscribeToOnboardingStatus,
} from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import { verifySentryDelivery } from '@/lib/sentry-verify';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { AnimatedSplash } from '../components/layout/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'dark';
  const [splashAnimationComplete, setSplashAnimationComplete] = React.useState(false);
  const [fontsLoaded, fontError] = useFonts({
    'ClashGrotesk-Medium': require('../assets/fonts/ClashGrotesk-Medium.otf'),
    'ClashGrotesk-SemiBold': require('../assets/fonts/ClashGrotesk-Semibold.otf'),
    'ClashGrotesk-Bold': require('../assets/fonts/ClashGrotesk-Bold.otf'),
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.otf'),
  });

  // Force dark mode for Crawl's dark-themed UI
  React.useEffect(() => {
    if (colorScheme !== 'dark') {
      setColorScheme('dark');
    }
  }, [colorScheme, setColorScheme]);

  // Prove the Sentry delivery path once per release build (no-op in dev / when
  // no DSN is configured). Without a real crash, this is what takes the project
  // out of its "waiting for first event" onboarding state.
  React.useEffect(() => {
    void verifySentryDelivery();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VenueProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: NAV_THEME[scheme].colors.background },
                animation: 'slide_from_right',
              }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="venue/[id]" />
              <Stack.Screen
                name="filters"
                options={{
                  presentation: 'transparentModal',
                  animation: 'fade',
                }}
              />
            </Stack>
            <OnboardingGate />
            <OfflineBanner />
            <StatusBar style="light" />
            <PortalHost />
            {!splashAnimationComplete && (
              <AnimatedSplash onAnimationComplete={() => setSplashAnimationComplete(true)} />
            )}
          </VenueProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

/**
 * Root error boundary. expo-router renders this whenever a child route throws
 * during render. Without it, a render-time crash white-screens the app with no
 * fallback and no report; here we forward the error to Sentry and offer a retry
 * so a single bad screen can't strand the whole session.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable onPress={retry} style={errorStyles.button}>
        <Text style={errorStyles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  message: {
    color: '#8b8ba5',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

/**
 * Reads the first-launch flag from AsyncStorage and redirects to (onboarding)
 * until the user finishes the onboarding flow. Lives inside the navigator so
 * it can use expo-router's <Redirect>.
 *
 * The flag is not the only source of truth (#158): a returning user proves
 * they already finished the auth step just by having a Supabase session that
 * was already persisted before this launch, regardless of what the flag read
 * back. The flag read and the session read are independent and settle at
 * different speeds — the flag is a single local AsyncStorage.getItem, while
 * the session read can itself trigger a network token refresh when the
 * persisted token is close to expiry (routine for a user reopening the app
 * after any real gap). `resolveOnboardingGateStatus` withholds rendering
 * until BOTH reads have settled so a still-`false` `hasReturningSession`
 * default can never let a stale flag-only redirect fire and strand a
 * returning user on the welcome screen (`<Redirect>` is one-shot; a later
 * re-render can't undo it).
 *
 * This read must not observe a session freshly minted for a genuinely new
 * install, or brand-new users would skip onboarding entirely. That holds
 * today because `ensureSignedIn()` (`src/lib/auth.ts`) only calls
 * `signInAnonymously()` — the sole call that creates and persists a new
 * session — after its own local `getSession()` read finds nothing; that read
 * and this gate's `getSession()` read race on the same underlying local
 * storage, and a local read finishes far faster than the network round trip
 * `signInAnonymously()` needs before anything new is persisted. This is a
 * real invariant, but a fragile one spanning two modules and supabase-js's
 * internals rather than a formal ordering guarantee — revisit it if
 * supabase-js is upgraded, a custom `lock` is added to the client, or
 * `ensureSignedIn()`'s existing-session-first check changes.
 *
 * `getSession()` can trigger a network token refresh, which has no built-in
 * timeout — a stalled request (bad connectivity, a Supabase incident, a
 * captive-portal wifi) would otherwise hold this gate in 'loading' forever
 * with no way for the user to proceed (#191). `readSessionWithTimeout` races
 * the read against `SESSION_READ_TIMEOUT_MS` and treats expiry as "no
 * returning session found", falling through to the flag's answer — the same
 * degraded-but-recoverable behavior as the pre-#158 code. Both the timeout
 * and a thrown read error are reported to Sentry, consistent with the flag
 * read's own failure reporting above.
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

function OnboardingGate() {
  const [flagStatus, setFlagStatus] = React.useState<'loading' | 'onboarding' | 'done'>('loading');
  const [sessionStatus, setSessionStatus] = React.useState<'loading' | 'done'>('loading');
  const [hasReturningSession, setHasReturningSession] = React.useState(false);
  const segments = useSegments();

  React.useEffect(() => {
    let mounted = true;

    readSessionWithTimeout()
      .then((hasSession) => {
        if (mounted) setHasReturningSession(hasSession);
      })
      .finally(() => {
        if (mounted) setSessionStatus('done');
      });

    const refresh = () => {
      readOnboardingFlag().then((done) => {
        if (mounted) setFlagStatus(done ? 'done' : 'onboarding');
      });
    };

    refresh();
    // Re-read the flag when markOnboardingComplete fires so finishing the
    // onboarding flow doesn't get bounced straight back to the splash.
    const unsubscribe = subscribeToOnboardingStatus(refresh);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const status = resolveOnboardingGateStatus(flagStatus, sessionStatus, hasReturningSession);

  // Hide everything until we know which branch to take. The Stack already
  // rendered above us; we just don't redirect yet.
  if (status === 'loading') {
    return <View style={{ display: 'none' }} />;
  }

  const inOnboardingGroup = segments[0] === '(onboarding)';
  if (status === 'onboarding' && !inOnboardingGroup) {
    return <Redirect href="/(onboarding)" />;
  }
  return null;
}
