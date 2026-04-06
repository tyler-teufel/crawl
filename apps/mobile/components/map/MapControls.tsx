import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function MapControls() {
  return (
    <View className="absolute bottom-4 right-4 gap-2">
      <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
        <Ionicons name="add" size={20} color="#fff" />
      </Pressable>
      <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
        <Ionicons name="remove" size={20} color="#fff" />
      </Pressable>
      <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
        <Ionicons name="locate" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}
