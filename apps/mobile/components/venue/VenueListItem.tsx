import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Venue } from '@/types/venue';
import { Badge } from '../ui/Badge';

interface VenueListItemProps {
  venue: Venue;
  rank: number;
  hasVoted: boolean;
  canVote: boolean;
  onVote: () => void;
  onPress: () => void;
}

export function VenueListItem({
  venue,
  rank,
  hasVoted,
  canVote,
  onVote,
  onPress,
}: VenueListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-crawl-lg border border-crawl-border bg-crawl-card p-4">
      {/* Rank */}
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-crawl-surface">
        <Text className="font-sans-bold text-sm text-crawl-purple-light">{rank}</Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink font-display-bold text-base text-white" numberOfLines={1}>
            {venue.name}
          </Text>
          {venue.isTrending && (
            <View className="shrink-0">
              <Badge label="HOT" variant="trending" />
            </View>
          )}
        </View>
        <Text className="mt-0.5 font-sans text-sm text-crawl-text-muted">
          {venue.primaryType} · {venue.voteCount} votes
        </Text>
      </View>

      {/* Score */}
      <View className="mr-3 items-center">
        <Text className="font-display-bold text-lg text-crawl-purple-light">
          {venue.hotspotScore}
        </Text>
        <Text className="font-sans text-xs text-crawl-text-muted">score</Text>
      </View>

      {/* Vote button */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onVote();
        }}
        disabled={!canVote && !hasVoted}
        className={`h-10 w-10 items-center justify-center rounded-full ${
          hasVoted
            ? 'bg-crawl-purple'
            : canVote
              ? 'bg-crawl-surface'
              : 'bg-crawl-surface opacity-40'
        }`}>
        <Ionicons
          name={hasVoted ? 'heart' : 'heart-outline'}
          size={18}
          color={hasVoted ? '#fff' : '#a855f7'}
        />
      </Pressable>
    </Pressable>
  );
}
