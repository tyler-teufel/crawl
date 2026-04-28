import React, { useRef } from 'react';
import { View, FlatList, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { FilterChip } from '../../components/ui/FilterChip';
import { CrawlMapView } from '../../components/map/CrawlMapView';
import { MapPlaceholder } from '../../components/map/MapPlaceholder';
import { VenueCard } from '../../components/venue/VenueCard';
import { VenueCardSkeleton } from '../../components/venue/VenueCardSkeleton';
import { CitySelector } from '../../components/voting/CitySelector';
import { ErrorState, EmptyState } from '../../components/ui/States';

const CARD_WIDTH = Dimensions.get('window').width * 0.8;

// Use the real map when the native module is available (after prebuild + npm install).
// `require()` is intentional here — it lets us probe for the module at runtime
// without crashing when react-native-maps isn't installed yet (e.g. Expo Go).
// ESM `import` would throw at module load.
let hasNativeMaps = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-maps');
  hasNativeMaps = true;
} catch {
  hasNativeMaps = false;
}

export default function ExploreScreen() {
  const router = useRouter();
  const {
    filteredVenues,
    filters,
    toggleFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    isVenuesLoading,
    isVenuesError,
    refetchVenues,
  } = useVenueContext();
  const flatListRef = useRef<FlatList>(null);

  const handleVenuePress = (venue: { id: string }) => router.push(`/venue/${venue.id}`);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-crawl-bg">
      {/* City selector */}
      <View className="items-center pt-2">
        <CitySelector />
      </View>

      {/* Search */}
      <View className="py-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilterPress={() => router.push('/filters')}
        />
      </View>

      {/* Filter chips */}
      <View className="h-12 justify-center">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}>
          {filters.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              icon={f.icon}
              active={f.enabled}
              onPress={() => toggleFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Map — overflow-hidden keeps MapView's native iOS view inside its flex bounds */}
      <View className="flex-1 overflow-hidden">
        {hasNativeMaps ? (
          <CrawlMapView venues={filteredVenues} onVenuePress={handleVenuePress} />
        ) : (
          <MapPlaceholder venues={filteredVenues} onPinPress={handleVenuePress} />
        )}
      </View>

      {/* Bottom venue carousel */}
      <View className="pb-2">
        {isVenuesLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}>
            {[0, 1, 2].map((i) => (
              <VenueCardSkeleton key={i} width={CARD_WIDTH} />
            ))}
          </ScrollView>
        ) : isVenuesError ? (
          <ErrorState
            title="Couldn't load venues"
            message="Check your connection and try again."
            onRetry={refetchVenues}
          />
        ) : filteredVenues.length === 0 ? (
          <EmptyState
            title="No venues match your filters"
            message="Try clearing a chip or switching cities."
            onRetry={resetFilters}
            retryLabel="Clear filters"
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredVenues}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <VenueCard venue={item} width={CARD_WIDTH} onPress={() => handleVenuePress(item)} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
