import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Venue } from '@/types/venue';
import { useVenue } from '@/api/venues';
import { useCastVote, useVoteState } from '@/api/votes';
import { useVenueContext } from '@/context/VenueContext';
import { parseWeeklyHours, todayHours, todayIndex } from '@/lib/venueHours';
import { HotspotScore } from '../../components/venue/HotspotScore';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/States';

/** "Cocktail Bar · $$ · 0.4 mi", skipping whatever the venue doesn't have. */
function metaLine(venue: Venue): string {
  const price = venue.priceLevel && venue.priceLevel > 0 ? '$'.repeat(venue.priceLevel) : '';
  return [venue.primaryType, price, venue.distance].filter(Boolean).join(' · ');
}

function openMaps(venue: Venue) {
  const label = encodeURIComponent(venue.name);
  const coords = `${venue.latitude},${venue.longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${label}&ll=${coords}`
      : `geo:${coords}?q=${coords}(${label})`;
  Linking.openURL(url).catch(() => {});
}

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCity } = useVenueContext();
  const [hoursExpanded, setHoursExpanded] = React.useState(false);

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

  // `venue.hours` is the whole week in one newline-joined string. Rendering it
  // raw dumped seven lines into the status row; today goes inline and the rest
  // lives behind the disclosure below.
  const week = parseWeeklyHours(venue.hours);
  const today = todayHours(venue.hours);
  const currentDay = todayIndex(week);
  const meta = metaLine(venue);

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
        {/* Hero */}
        <View className="mx-4 h-48 items-center justify-center overflow-hidden rounded-2xl bg-crawl-card">
          {venue.imageUrl ? (
            <Image source={{ uri: venue.imageUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={48} color="#5b0daa" />
          )}
        </View>

        {/* Name, type, open state */}
        <View className="mt-4 px-4">
          <View className="flex-row items-start gap-2">
            <Text className="shrink font-display-bold text-2xl text-white">{venue.name}</Text>
            {venue.isTrending && <Badge label="TRENDING" variant="trending" />}
          </View>
          {meta ? (
            <Text className="mt-1 font-sans text-sm text-crawl-text-muted">{meta}</Text>
          ) : null}

          <View className="mt-3 flex-row items-center gap-2">
            <Badge
              label={venue.isOpen ? 'OPEN' : 'CLOSED'}
              variant={venue.isOpen ? 'open' : 'closed'}
            />
            {today ? (
              <Text className="shrink font-sans text-sm text-crawl-text-muted" numberOfLines={1}>
                Today {today.hours}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Hotspot Score */}
        <View className="mt-6 items-center">
          <HotspotScore score={venue.hotspotScore} />
          <Text className="mt-2 font-sans text-sm text-crawl-text-muted">
            {venue.voteCount} {venue.voteCount === 1 ? 'vote' : 'votes'} today
          </Text>
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
                  className={`ml-2 font-sans-bold text-base ${hasVoted ? 'text-crawl-purple' : 'text-white'}`}>
                  {hasVoted ? 'Voted!' : "Vote as Tonight's Hotspot"}
                </Text>
              </>
            )}
          </Pressable>
          {!canVote && !hasVoted && (
            <Text className="mt-2 text-center font-sans text-xs text-crawl-text-muted">
              No votes remaining today
            </Text>
          )}
        </View>

        {/* Quick actions — only what this venue actually has */}
        <View className="mt-6 flex-row gap-3 px-4">
          <ActionButton icon="navigate" label="Directions" onPress={() => openMaps(venue)} />
          {venue.phone ? (
            <ActionButton
              icon="call"
              label="Call"
              onPress={() => Linking.openURL(`tel:${venue.phone}`).catch(() => {})}
            />
          ) : null}
          {venue.website ? (
            <ActionButton
              icon="globe-outline"
              label="Website"
              onPress={() => Linking.openURL(venue.website!).catch(() => {})}
            />
          ) : null}
        </View>

        {/* Hours */}
        {week.length > 1 ? (
          <View className="mt-6 px-4">
            <Pressable
              onPress={() => setHoursExpanded((prev) => !prev)}
              accessibilityRole="button"
              className="flex-row items-center justify-between rounded-crawl-lg border border-crawl-border bg-crawl-card px-4 py-3 active:opacity-80">
              <View className="flex-row items-center gap-3">
                <Ionicons name="time-outline" size={18} color="#8b8ba5" />
                <Text className="font-sans-medium text-sm text-white">Hours</Text>
              </View>
              <Ionicons
                name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#8b8ba5"
              />
            </Pressable>
            {hoursExpanded ? (
              <View className="mt-2 gap-2 rounded-crawl-lg border border-crawl-border bg-crawl-card px-4 py-3">
                {week.map((entry, index) => (
                  <View key={entry.day || index} className="flex-row justify-between gap-4">
                    <Text
                      className={`font-sans text-sm ${
                        index === currentDay ? 'text-white' : 'text-crawl-text-muted'
                      }`}>
                      {entry.day}
                    </Text>
                    <Text
                      className={`flex-1 text-right font-sans text-sm ${
                        index === currentDay ? 'text-white' : 'text-crawl-text-muted'
                      }`}>
                      {entry.hours}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Description — hidden when the venue record has none, rather than
            rendering an "About" heading over empty space. */}
        {venue.description ? (
          <View className="mt-6 px-4">
            <Text className="font-display-bold text-base text-white">About</Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-crawl-text-muted">
              {venue.description}
            </Text>
          </View>
        ) : null}

        {/* Highlights */}
        {venue.highlights.length > 0 ? (
          <View className="mt-6 px-4">
            <Text className="font-display-bold text-base text-white">Highlights</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {venue.highlights.map((h: string) => (
                <View
                  key={h}
                  className="flex-row items-center rounded-full bg-crawl-card px-3 py-2">
                  <Ionicons name="sparkles" size={14} color="#a855f7" />
                  <Text className="ml-1 font-sans text-sm text-crawl-purple-light">{h}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Address */}
        <View className="mt-6 px-4 pb-8">
          <Text className="font-display-bold text-base text-white">Location</Text>
          <Pressable
            onPress={() => openMaps(venue)}
            accessibilityRole="button"
            className="mt-2 flex-row items-center gap-2 rounded-2xl bg-crawl-card p-4 active:opacity-80">
            <Ionicons name="location" size={20} color="#a855f7" />
            <Text className="flex-1 font-sans text-sm text-crawl-text-muted">{venue.address}</Text>
            <Ionicons name="navigate" size={18} color="#8b8ba5" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 items-center gap-1 rounded-crawl-lg border border-crawl-border bg-crawl-card py-3 active:opacity-80">
      <Ionicons name={icon} size={18} color="#a855f7" />
      <Text className="font-sans-medium text-xs text-white">{label}</Text>
    </Pressable>
  );
}
