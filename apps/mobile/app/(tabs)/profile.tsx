import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-crawl-bg"
      style={{ paddingTop: insets.top }}>
      <Ionicons name="person-outline" size={64} color="#5b0daa" />
      <Text className="mt-4 text-xl font-bold text-white">Your Profile</Text>
      <Text className="mt-2 text-sm text-crawl-text-muted">Coming Soon</Text>
    </View>
  );
}
