import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout for the Expo Router file-based navigation tree.
 * The map screen is full-bleed, so no SafeAreaView wrapper is applied here –
 * each screen manages its own safe-area insets via absolute positioning.
 */
export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0F1E' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
