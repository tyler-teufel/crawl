import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Venue } from '@/types/venue';
import { ELEVATION } from '@/lib/theme';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  width: number;
}

const HERO_HEIGHT = 96;

export function VenueCard({ venue, onPress, width }: VenueCardProps) {
  const priceLevel = venue.priceLevel;

  return (
    // Outer wrapper carries the elevation shadow + shape (NO overflow-hidden, which
    // would clip the drop shadow on iOS); inner view clips the hero image corners.
    <View
      style={[{ width, maxHeight: 230 }, ELEVATION[2]]}
      className="mr-4 rounded-crawl-lg border border-crawl-border bg-crawl-card">
      <Pressable onPress={onPress} className="overflow-hidden rounded-crawl-lg">
        {/* Hero — photography-first; graceful tinted placeholder when imageUrl is absent */}
        <View style={{ height: HERO_HEIGHT }} className="w-full overflow-hidden bg-crawl-surface">
          {venue.imageUrl ? (
            <Image source={{ uri: venue.imageUrl }} resizeMode="cover" className="h-full w-full" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-crawl-purple/10">
              <Ionicons name="wine" size={28} color="#a855f7" />
            </View>
          )}

          {/* Badges over the image */}
          <View className="absolute bottom-2 left-2 flex-row gap-1">
            {venue.isTrending && <Badge label="Trending" variant="trending" />}
            {venue.isOpen && <Badge label="Open Now" variant="open" />}
          </View>

          {/* Bookmark affordance — presentational only; real save-venue is follow-up work */}
          <View className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-crawl-bg/60">
            <Ionicons name="bookmark-outline" size={16} color="#fff" />
          </View>
        </View>

        {/* Content */}
        <View className="p-3">
          <Text className="font-display-bold text-lg text-white" numberOfLines={1}>
            {venue.name}
          </Text>
          <View className="mt-0.5 flex-row items-center">
            {priceLevel != null && (
              <Text className="font-sans-medium text-sm">
                {[0, 1, 2, 3].map((i) => (
                  <Text
                    key={i}
                    className={i < priceLevel ? 'text-crawl-green' : 'text-crawl-text-muted'}>
                    $
                  </Text>
                ))}
                <Text className="text-crawl-text-muted"> · </Text>
              </Text>
            )}
            <Text className="flex-1 font-sans text-sm text-crawl-text-muted" numberOfLines={1}>
              {`${venue.primaryType} · ${venue.distance}`}
            </Text>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-crawl-purple">
                <Text className="font-sans-bold text-xs text-white">{venue.hotspotScore}</Text>
              </View>
              <Text className="font-sans text-xs text-crawl-text-muted">
                {venue.voteCount} votes
              </Text>
            </View>
            <Button
              label="Details"
              variant="primary"
              icon="arrow-forward"
              onPress={onPress}
              className="px-3 py-1.5"
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
