import React from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';

export default function FiltersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, toggleFilter, resetFilters } = useVenueContext();

  return (
    <View className="flex-1 bg-black/60">
      <Pressable className="flex-1" onPress={() => router.back()} />

      <View
        className="rounded-t-3xl bg-crawl-bg px-4 pt-6"
        style={{ paddingBottom: insets.bottom + 16 }}>
        {/* Handle */}
        <View className="mb-4 items-center">
          <View className="h-1 w-10 rounded-full bg-crawl-card" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white">Filters</Text>
          <View className="flex-row gap-4">
            <Pressable onPress={resetFilters}>
              <Text className="text-sm text-crawl-purple-light">Reset</Text>
            </Pressable>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Filter list */}
        <ScrollView className="mt-4 max-h-96">
          {filters.map((filter) => (
            <View
              key={filter.id}
              className="flex-row items-center justify-between border-b border-crawl-card py-4">
              <View className="flex-row items-center gap-3">
                {filter.icon && (
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-crawl-surface">
                    <Ionicons
                      name={filter.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color="#a855f7"
                    />
                  </View>
                )}
                <Text className="text-base text-white">{filter.label}</Text>
              </View>
              <Switch
                value={filter.enabled}
                onValueChange={() => toggleFilter(filter.id)}
                trackColor={{ false: '#1a1a2e', true: '#7f13ec' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </ScrollView>

        {/* Apply button */}
        <Pressable
          onPress={() => router.back()}
          className="mt-4 items-center rounded-full bg-crawl-purple py-4">
          <Text className="text-base font-bold text-white">Apply Filters</Text>
        </Pressable>
      </View>
    </View>
  );
}
