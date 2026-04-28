import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';
import { VoteCounter } from '../../components/voting/VoteCounter';
import { CountdownTimer } from '../../components/voting/CountdownTimer';
import { CitySelector } from '../../components/voting/CitySelector';
import { VenueListItem } from '../../components/venue/VenueListItem';
import { VenueListItemSkeleton } from '../../components/venue/VenueListItemSkeleton';
import { ErrorState, EmptyState } from '../../components/ui/States';

export default function VotingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { venues, voteState, castVote, removeVote, isVenuesLoading, isVenuesError, refetchVenues } =
    useVenueContext();

  const sortedVenues = [...venues].sort((a, b) => b.hotspotScore - a.hotspotScore);

  return (
    <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center px-4 pt-4">
          <Text className="text-2xl font-bold text-white">Daily Hotspot Votes</Text>
          <Text className="mt-1 text-sm text-crawl-text-muted">
            Vote for tonight&apos;s hottest spots
          </Text>
        </View>

        {/* City selector */}
        <View className="mt-4 items-center">
          <CitySelector />
        </View>

        {/* Vote counter */}
        <View className="mt-6 items-center">
          <VoteCounter remaining={voteState.remainingVotes} max={voteState.maxVotes} />
        </View>

        {/* Countdown */}
        <View className="mt-6 items-center">
          <CountdownTimer />
        </View>

        {/* Trending header */}
        <View className="mt-8 px-4">
          <Text className="text-lg font-bold text-white">Trending Tonight</Text>
          <Text className="mt-0.5 text-sm text-crawl-text-muted">Ranked by hotspot score</Text>
        </View>

        {/* Venue list */}
        <View className="mt-4 px-4 pb-4">
          {isVenuesLoading ? (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <VenueListItemSkeleton key={i} />
              ))}
            </>
          ) : isVenuesError ? (
            <ErrorState
              title="Couldn't load rankings"
              message="Check your connection and try again."
              onRetry={refetchVenues}
            />
          ) : sortedVenues.length === 0 ? (
            <EmptyState
              title="No venues yet"
              message="Nothing's been submitted for this city tonight."
            />
          ) : (
            sortedVenues.map((venue, index) => {
              const hasVoted = voteState.votedVenueIds.includes(venue.id);
              const canVote = voteState.remainingVotes > 0;

              return (
                <VenueListItem
                  key={venue.id}
                  venue={venue}
                  rank={index + 1}
                  hasVoted={hasVoted}
                  canVote={canVote}
                  onVote={() => {
                    if (hasVoted) {
                      removeVote(venue.id);
                    } else {
                      castVote(venue.id);
                    }
                  }}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
