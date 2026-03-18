import '../global.css';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VenueProvider } from '@/context/VenueContext';

export default function RootLayout() {
  return (
    <VenueProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0f' },
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
    </VenueProvider>
  );
}
