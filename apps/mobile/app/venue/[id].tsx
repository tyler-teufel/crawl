import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVenue } from '@/api/venues';
import { useCastVote, useVoteState } from '@/api/votes';
import { useVenueContext } from '@/context/VenueContext';
import { HotspotScore } from '../../components/venue/HotspotScore';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/States';

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCity } = useVenueContext();

  const { data: venue, isLoading, isError, refetch } = useVenue(id!);
  const { data: voteState } = useVoteState(selectedCity);
  const castVote = useCastVote(selectedCity);

  const hasVoted = voteState?.votedVenueIds.includes(id!) ?? false;
  const canVote = (voteState?.remainingVotes ?? 0) > 0 && !hasVoted;

  function handleVote() {
    if (!canVote || castVote.isPending) return;
    castVote.mutate(id!);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </View>
        <Skeleton className="mx-4 h-48 rounded-2xl" />
        <View className="mt-4 px-4">
          <Skeleton className="h-7 w-2/3 rounded" />
          <Skeleton className="mt-2 h-4 w-1/2 rounded" />
        </View>
        <View className="mt-6 items-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </View>
        <View className="mt-6 px-4">
          <Skeleton className="h-12 w-full rounded-full" />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <ErrorState
            title="Couldn't load venue"
            message="Check your connection and try again."
            onRetry={() => refetch()}
          />
        </View>
      </View>
    );
  }

  if (!venue) {
    return (
      <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <ErrorState
            title="Venue not found"
            message="This venue may have been removed."
            icon="help-circle-outline"
            onRetry={() => router.back()}
            retryLabel="Go back"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-crawl-card">
          <Ionicons name="share-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Venue image placeholder */}
        <View className="mx-4 h-48 items-center justify-center rounded-2xl bg-crawl-card">
          <Ionicons name="image-outline" size={48} color="#5b0daa" />
        </View>

        {/* Name and badges */}
        <View className="mt-4 px-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-bold text-white">{venue.name}</Text>
            {venue.isTrending && <Badge label="TRENDING" variant="trending" />}
          </View>
          <Text className="mt-1 text-sm text-crawl-text-muted">
            {venue.primaryType} · {venue.distance}
          </Text>
        </View>

        {/* Status row */}
        <View className="mt-3 flex-row items-center gap-4 px-4">
          <Badge
            label={venue.isOpen ? 'OPEN' : 'CLOSED'}
            variant={venue.isOpen ? 'open' : 'closed'}
          />
          <Text className="text-sm text-crawl-text-muted">{venue.hours}</Text>
          <View className="flex-row">
            {[...Array(venue.priceLevel)].map((_, i) => (
              <Text key={i} className="text-sm font-bold text-crawl-green">
                $
              </Text>
            ))}
          </View>
        </View>

        {/* Hotspot Score */}
        <View className="mt-6 items-center">
          <HotspotScore score={venue.hotspotScore} />
          <Text className="mt-2 text-sm text-crawl-text-muted">{venue.voteCount} votes today</Text>
        </View>

        {/* Vote button */}
        <View className="mt-6 px-4">
          <Pressable
            onPress={handleVote}
            disabled={!canVote || castVote.isPending}
            className={`flex-row items-center justify-center rounded-full py-4 ${
              hasVoted ? 'bg-crawl-card' : canVote ? 'bg-crawl-purple' : 'bg-crawl-card opacity-50'
            }`}>
            {castVote.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name={hasVoted ? 'heart' : 'heart-outline'}
                  size={20}
                  color={hasVoted ? '#a855f7' : '#fff'}
                />
                <Text
                  className={`ml-2 text-base font-bold ${hasVoted ? 'text-crawl-purple' : 'text-white'}`}>
                  {hasVoted ? 'Voted!' : "Vote as Tonight's Hotspot"}
                </Text>
              </>
            )}
          </Pressable>
          {!canVote && !hasVoted && (
            <Text className="mt-2 text-center text-xs text-crawl-text-muted">
              No votes remaining today
            </Text>
          )}
        </View>

        {/* Description */}
        <View className="mt-6 px-4">
          <Text className="text-base font-bold text-white">About</Text>
          <Text className="mt-2 text-sm leading-6 text-crawl-text-muted">{venue.description}</Text>
        </View>

        {/* Highlights */}
        <View className="mt-6 px-4">
          <Text className="text-base font-bold text-white">Highlights</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {venue.highlights.map((h: string) => (
              <View key={h} className="flex-row items-center rounded-full bg-crawl-card px-3 py-2">
                <Ionicons name="sparkles" size={14} color="#a855f7" />
                <Text className="ml-1 text-sm text-crawl-purple-light">{h}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Address */}
        <View className="mt-6 px-4 pb-8">
          <Text className="text-base font-bold text-white">Location</Text>
          <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-crawl-card p-4">
            <Ionicons name="location" size={20} color="#a855f7" />
            <Text className="flex-1 text-sm text-crawl-text-muted">{venue.address}</Text>
            <Ionicons name="navigate" size={18} color="#9ca3af" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
