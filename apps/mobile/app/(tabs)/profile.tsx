import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useVenueContext } from '@/context/VenueContext';
import { Venue } from '@/types/venue';

function initialsFrom(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAnonymous, signOut } = useAuth();
  const { voteState, venues } = useVenueContext();

  const displayName = isAnonymous
    ? 'Guest'
    : ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Crawler');

  // Today's voting history: the mock vote layer only persists votedVenueIds
  // for the current day (src/api/voteStorage.ts). Once a server-backed
  // history endpoint exists, swap this for a `useVoteHistory` hook that
  // follows the same hasApi mock/real branching as src/api/votes.ts.
  const votedVenues = voteState.votedVenueIds
    .map((id) => venues.find((venue) => venue.id === id))
    .filter((venue): venue is Venue => Boolean(venue));

  const votesToday = voteState.maxVotes - voteState.remainingVotes;

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(onboarding)');
    } catch (err) {
      Alert.alert('Sign out failed', (err as Error).message);
    }
  };

  return (
    <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + identity */}
        <View className="items-center px-4 pt-6">
          <View className="h-20 w-20 items-center justify-center rounded-full border border-crawl-border bg-crawl-surface">
            {isAnonymous ? (
              <Ionicons name="person-outline" size={36} color="#a855f7" />
            ) : (
              <Text className="font-display-bold text-2xl text-crawl-purple-light">
                {initialsFrom(displayName)}
              </Text>
            )}
          </View>
          <Text className="mt-4 font-display-bold text-2xl text-white">{displayName}</Text>
          {isAnonymous ? (
            <Text className="mt-1 font-sans text-sm text-crawl-text-muted">
              Signed in anonymously
            </Text>
          ) : null}
        </View>

        {/* Stats */}
        <View className="mt-8 flex-row gap-3 px-4">
          <View className="flex-1 items-center rounded-crawl-lg border border-crawl-border bg-crawl-card py-4">
            <Text className="font-display-bold text-2xl text-white">{votesToday}</Text>
            <Text className="mt-1 font-sans text-xs text-crawl-text-muted">Votes Today</Text>
          </View>
          <View className="flex-1 items-center rounded-crawl-lg border border-crawl-border bg-crawl-card py-4">
            <Text className="font-display-bold text-2xl text-crawl-text-muted">—</Text>
            <Text className="mt-1 font-sans text-xs text-crawl-text-muted">Streak (soon)</Text>
          </View>
        </View>

        {/* Voting history */}
        <View className="mt-8 px-4">
          <Text className="font-display-bold text-lg text-white">Today&apos;s Votes</Text>
          {votedVenues.length === 0 ? (
            <Text className="mt-2 font-sans text-sm text-crawl-text-muted">
              You haven&apos;t voted for any venues yet today.
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {votedVenues.map((venue) => (
                <Pressable
                  key={venue.id}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  className="flex-row items-center justify-between rounded-crawl-lg border border-crawl-border bg-crawl-card px-4 py-3 active:opacity-80">
                  <Text className="shrink font-sans-medium text-sm text-white" numberOfLines={1}>
                    {venue.name}
                  </Text>
                  <Ionicons name="heart" size={16} color="#a855f7" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Settings */}
        <View className="mt-8 px-4">
          <Text className="font-display-bold text-lg text-white">Settings</Text>
          <View className="mt-3 overflow-hidden rounded-crawl-lg border border-crawl-border bg-crawl-card">
            <SettingsRow icon="notifications-outline" label="Notifications" />
            <SettingsRow icon="location-outline" label="Location" />
            <SettingsRow icon="help-circle-outline" label="Help & Support" last />
          </View>
        </View>

        {/* Sign out */}
        <View className="mb-8 mt-8 px-4">
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-crawl-lg border border-crawl-border bg-crawl-card px-4 py-4 active:opacity-80">
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text className="font-sans-bold text-sm text-destructive">Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 ${
        last ? '' : 'border-b border-crawl-border'
      }`}>
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={18} color="#8b8ba5" />
        <Text className="font-sans text-sm text-white">{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8b8ba5" />
    </View>
  );
}
