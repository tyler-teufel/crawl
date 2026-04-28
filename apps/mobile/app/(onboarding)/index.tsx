import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingWelcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-between bg-crawl-bg px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }}>
      <View className="items-center">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-crawl-purple/20">
          <Ionicons name="compass" size={48} color="#a855f7" />
        </View>
        <Text className="mt-6 text-3xl font-bold text-white">Welcome to Crawl</Text>
        <Text className="mt-3 text-center text-base text-crawl-text-muted">
          Discover tonight&apos;s hotspots, vote on the best venues, and find your crew&apos;s next
          stop.
        </Text>
      </View>

      <View className="w-full">
        <Pressable
          onPress={() => router.push('/(onboarding)/location')}
          className="items-center rounded-2xl bg-crawl-purple px-6 py-4 active:opacity-80">
          <Text className="text-base font-semibold text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}
