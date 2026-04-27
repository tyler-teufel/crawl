import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

/**
 * Foreground location permission prompt. Skippable.
 *
 * On grant, captures coords (Balanced accuracy) and stashes them in AuthContext
 * so the explore screen can later seed the initial city. On deny/skip, leaves
 * userLocation null — the app falls back to the default city.
 */
export default function OnboardingLocation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUserLocation } = useAuth();
  const [requesting, setRequesting] = useState(false);

  const goNext = () => router.push('/(onboarding)/auth');

  const requestLocation = async () => {
    setRequesting(true);
    try {
      // Lazy import — keeps Expo Go bootable when expo-location native module is missing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[onboarding/location] failed:', err);
      }
    } finally {
      setRequesting(false);
      goNext();
    }
  };

  return (
    <View
      className="flex-1 items-center justify-between bg-crawl-bg px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }}>
      <View className="items-center">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-crawl-purple/20">
          <Ionicons name="location" size={44} color="#a855f7" />
        </View>
        <Text className="mt-6 text-2xl font-bold text-white">Find venues near you</Text>
        <Text className="mt-3 text-center text-base text-crawl-text-muted">
          Crawl uses your location to surface nearby bars, clubs, and tonight&apos;s hottest spots.
          You can change this later in Settings.
        </Text>
      </View>

      <View className="w-full">
        <Pressable
          onPress={requestLocation}
          disabled={requesting}
          className="items-center rounded-2xl bg-crawl-purple px-6 py-4 active:opacity-80 disabled:opacity-60">
          {requesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Enable Location</Text>
          )}
        </Pressable>
        <Pressable
          onPress={goNext}
          disabled={requesting}
          className="mt-3 items-center px-6 py-3 active:opacity-80">
          <Text className="text-sm font-medium text-crawl-text-muted">Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
