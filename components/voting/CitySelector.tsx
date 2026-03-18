import React from 'react';
import { Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CitySelectorProps {
  city: string;
  onPress: () => void;
}

export function CitySelector({ city, onPress }: CitySelectorProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-full bg-crawl-card px-4 py-2">
      <Ionicons name="location" size={16} color="#a855f7" />
      <Text className="text-sm font-medium text-white">{city}</Text>
      <Ionicons name="chevron-down" size={14} color="#9ca3af" />
    </Pressable>
  );
}
