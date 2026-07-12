import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingWelcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between bg-crawl-bg px-6"
      style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }}>
      <View className="items-center gap-3">
        <Text className="font-display-bold text-5xl lowercase text-crawl-purple-light">crawl</Text>
      </View>

      <View className="items-center gap-4">
        <Text className="font-display-bold text-4xl text-white">Welcome to Crawl</Text>
        <Text className="text-center font-sans text-base leading-6 text-crawl-text-secondary">
          Discover tonight&apos;s hotspots, vote on the best venues, and find your crew&apos;s next
          stop.
        </Text>
      </View>

      <View className="w-full gap-8">
        <View className="flex-row items-center justify-center gap-2">
          <View className="h-2 w-2 rounded-full bg-crawl-purple-light" />
          <View className="h-2 w-2 rounded-full bg-crawl-border" />
          <View className="h-2 w-2 rounded-full bg-crawl-border" />
        </View>
        <Pressable
          onPress={() => router.push('/(onboarding)/location')}
          className="items-center rounded-crawl-lg bg-crawl-purple px-6 py-4 active:opacity-80">
          <Text className="font-sans-bold text-base text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}
