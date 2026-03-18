import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress: () => void;
}

export function SearchBar({ value, onChangeText, onFilterPress }: SearchBarProps) {
  return (
    <View className="flex-row items-center gap-3 px-4">
      <View className="flex-1 flex-row items-center rounded-full bg-crawl-card px-4 py-3">
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          className="ml-2 flex-1 text-base text-white"
          placeholder="Search bars & venues..."
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
      <Pressable
        onPress={onFilterPress}
        className="h-12 w-12 items-center justify-center rounded-full bg-crawl-purple">
        <Ionicons name="options" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}
