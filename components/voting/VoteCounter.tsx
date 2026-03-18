import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoteCounterProps {
  remaining: number;
  max: number;
}

export function VoteCounter({ remaining, max }: VoteCounterProps) {
  return (
    <View className="items-center">
      <View className="flex-row items-end">
        <Text className="text-6xl font-bold text-crawl-purple-light">{remaining}</Text>
        <Text className="mb-2 ml-1 text-xl text-crawl-text-muted">/ {max}</Text>
      </View>
      <View className="mt-1 flex-row items-center gap-1">
        <Ionicons name="heart" size={14} color="#a855f7" />
        <Text className="text-sm text-crawl-text-muted">Votes Remaining Today</Text>
      </View>
    </View>
  );
}
