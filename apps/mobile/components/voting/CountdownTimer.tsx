import React from 'react';
import { View, Text } from 'react-native';
import { useCountdown } from '@/hooks/useCountdown';

export function CountdownTimer() {
  const { hours, minutes, seconds } = useCountdown();

  return (
    <View className="items-center">
      <Text className="mb-2 font-sans text-xs uppercase text-crawl-text-muted">Votes Reset In</Text>
      <View className="flex-row items-center gap-2">
        <TimeBlock value={hours} label="HRS" />
        <Text className="font-display-bold text-xl text-crawl-purple-light">:</Text>
        <TimeBlock value={minutes} label="MIN" />
        <Text className="font-display-bold text-xl text-crawl-purple-light">:</Text>
        <TimeBlock value={seconds} label="SEC" />
      </View>
    </View>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center rounded-xl bg-crawl-card px-3 py-2">
      <Text className="font-display-bold text-xl text-white">{value}</Text>
      <Text className="font-sans text-xs text-crawl-text-muted">{label}</Text>
    </View>
  );
}
