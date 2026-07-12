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
import { isOnboardingComplete, subscribeToOnboardingStatus } from '@/lib/onboarding';
import { verifySentryDelivery } from '@/lib/sentry-verify';
import { OfflineBanner } from '../components/ui/OfflineBanner';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'dark';
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
 */
function OnboardingGate() {
  const [status, setStatus] = React.useState<'loading' | 'onboarding' | 'done'>('loading');
  const segments = useSegments();

  React.useEffect(() => {
    let mounted = true;

    const refresh = () => {
      isOnboardingComplete()
        .then((done) => {
          if (mounted) setStatus(done ? 'done' : 'onboarding');
        })
        .catch(() => {
          // If AsyncStorage throws, default to showing onboarding rather than
          // skipping it — better to over-prompt than to leave a new user stranded.
          if (mounted) setStatus('onboarding');
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
