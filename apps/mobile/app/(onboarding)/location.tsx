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
      style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }}>
      <View className="items-center gap-6">
        <View className="h-40 w-40 items-center justify-center rounded-full border border-crawl-border">
          <View className="h-28 w-28 items-center justify-center rounded-full border border-crawl-divider">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-crawl-purple/20">
              <Ionicons name="location" size={44} color="#a855f7" />
            </View>
          </View>
        </View>
        <View className="items-center gap-4">
          <Text className="font-display-bold text-3xl text-white">Find venues near you</Text>
          <Text className="text-center font-sans text-base leading-6 text-crawl-text-secondary">
            Crawl uses your location to surface nearby bars, clubs, and tonight&apos;s hottest
            spots. You can change this later in Settings.
          </Text>
        </View>
      </View>

      <View className="w-full">
        <Pressable
          onPress={requestLocation}
          disabled={requesting}
          className="flex-row items-center justify-center gap-2 rounded-crawl-lg bg-crawl-purple px-6 py-4 active:opacity-80 disabled:opacity-60">
          {requesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text className="font-sans-bold text-base text-white">Enable Location</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={goNext}
          disabled={requesting}
          className="mt-3 items-center px-6 py-3 active:opacity-80">
          <Text className="font-sans-medium text-sm text-crawl-purple-light">Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
