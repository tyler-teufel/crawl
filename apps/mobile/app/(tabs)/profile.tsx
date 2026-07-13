import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-crawl-bg px-8"
      style={{ paddingTop: insets.top }}>
      <View className="h-20 w-20 items-center justify-center rounded-crawl-xl border border-crawl-border bg-crawl-surface">
        <Ionicons name="person-outline" size={40} color="#a855f7" />
      </View>
      <Text className="mt-6 font-display-bold text-2xl text-white">Your Profile</Text>
      <Text className="mt-2 text-center font-sans text-sm text-crawl-text-muted">Coming Soon</Text>
    </View>
  );
}
