import React from 'react';
import { View, Text, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';
import { useTrending } from '@/api/trending';
import { Venue } from '@/types/venue';
import { CitySelector } from '../../components/voting/CitySelector';
import { VenueCard } from '../../components/venue/VenueCard';
import { VenueCardSkeleton } from '../../components/venue/VenueCardSkeleton';
import { ErrorState, EmptyState } from '../../components/ui/States';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

export default function GlobalScreen() {
  const router = useRouter();
  const { selectedCity } = useVenueContext();
  const { data: venues = [], isLoading, isError, refetch } = useTrending(selectedCity);

  const handleVenuePress = (venue: Venue) => router.push(`/venue/${venue.id}`);
  const handleRetry = () => {
    void refetch();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-crawl-bg">
      <View className="items-center px-8 pt-4">
        <Text className="font-display-bold text-2xl text-white">Global Rankings</Text>
        <Text className="mt-1 text-center font-sans text-sm text-crawl-text-muted">
          All-time top venues, ranked by hotspot score
        </Text>
      </View>

      <View className="items-center py-4">
        <CitySelector />
      </View>

      <View className="flex-1">
        {isLoading ? (
          <View className="px-4 pt-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="mb-3">
                <VenueCardSkeleton width={CARD_WIDTH} />
              </View>
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title="Couldn't load rankings"
            message="Check your connection and try again."
            onRetry={handleRetry}
          />
        ) : venues.length === 0 ? (
          <EmptyState title="No venues yet" message="Nothing's trending in this city yet." />
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <VenueCard venue={item} width={CARD_WIDTH} onPress={() => handleVenuePress(item)} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
