import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Venue } from '@/types/venue';
import { Badge } from '../ui/Badge';

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  width: number;
}

export function VenueCard({ venue, onPress, width }: VenueCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      className="mr-4 overflow-hidden rounded-2xl bg-crawl-card p-4">
      {/* Header row */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            {venue.name}
          </Text>
          <Text className="mt-0.5 text-sm text-crawl-text-muted">
            {venue.primaryType} · {venue.distance}
          </Text>
        </View>
        <View className="items-end gap-1">
          {venue.isTrending && <Badge label="Trending" variant="trending" />}
          {venue.isOpen && <Badge label="Open" variant="open" />}
        </View>
      </View>

      {/* Score and votes */}
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-crawl-purple">
            <Text className="text-sm font-bold text-white">{venue.hotspotScore}</Text>
          </View>
          <View className="ml-2">
            <Text className="text-xs text-crawl-text-muted">Hotspot Score</Text>
            <Text className="text-sm font-semibold text-white">{venue.voteCount} votes</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          {[...Array(venue.priceLevel ?? 0)].map((_, i) => (
            <Text key={i} className="text-sm font-bold text-crawl-green">
              $
            </Text>
          ))}
          {[...Array(4 - (venue.priceLevel ?? 0))].map((_, i) => (
            <Text key={i} className="text-sm text-crawl-text-muted">
              $
            </Text>
          ))}
        </View>
      </View>

      {/* Highlights */}
      <View className="mt-3 flex-row flex-wrap gap-1">
        {venue.highlights.slice(0, 3).map((h) => (
          <View key={h} className="rounded-full bg-crawl-surface px-2 py-1">
            <Text className="text-xs text-crawl-purple-light">{h}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={onPress}
        className="mt-3 flex-row items-center justify-center rounded-full bg-crawl-purple py-2">
        <Ionicons name="arrow-forward" size={16} color="#fff" />
        <Text className="ml-1 text-sm font-semibold text-white">View Details</Text>
      </Pressable>
    </Pressable>
  );
}
