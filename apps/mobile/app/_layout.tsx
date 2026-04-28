import '../global.css';
import * as React from 'react';
import { View } from 'react-native';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/query-client';
import { AuthProvider } from '@/context/AuthContext';
import { VenueProvider } from '@/context/VenueContext';
import { NAV_THEME } from '@/lib/theme';
import { isOnboardingComplete } from '@/lib/onboarding';
import { OfflineBanner } from '../components/ui/OfflineBanner';

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'dark';

  // Force dark mode for Crawl's dark-themed UI
  React.useEffect(() => {
    if (colorScheme !== 'dark') {
      setColorScheme('dark');
    }
  }, [colorScheme, setColorScheme]);

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
    isOnboardingComplete()
      .then((done) => {
        if (mounted) setStatus(done ? 'done' : 'onboarding');
      })
      .catch(() => {
        // If AsyncStorage throws, default to showing onboarding rather than
        // skipping it — better to over-prompt than to leave a new user stranded.
        if (mounted) setStatus('onboarding');
      });
    return () => {
      mounted = false;
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
