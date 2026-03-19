import '../global.css';
import * as React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { PortalHost } from '@rn-primitives/portal';
import { VenueProvider } from '@/context/VenueContext';
import { NAV_THEME } from '@/lib/theme';

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
      <VenueProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: NAV_THEME[scheme].colors.background },
            animation: 'slide_from_right',
          }}>
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
        <StatusBar style="light" />
        <PortalHost />
      </VenueProvider>
    </ThemeProvider>
  );
}
