import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'trending' | 'open' | 'closed';
}

export function Badge({ label, variant = 'trending' }: BadgeProps) {
  const bgColor =
    variant === 'trending'
      ? 'bg-crawl-purple'
      : variant === 'open'
        ? 'bg-crawl-green'
        : 'bg-red-500';

  return (
    <View className={`rounded-full px-2 py-0.5 ${bgColor}`}>
      <Text className="text-xs font-bold uppercase text-white">{label}</Text>
    </View>
  );
}
