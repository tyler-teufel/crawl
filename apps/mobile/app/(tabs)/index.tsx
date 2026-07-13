import React, { useState } from 'react';
import { View, ScrollView, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { FilterChip } from '../../components/ui/FilterChip';
import { CrawlMapView } from '../../components/map/CrawlMapView';
import { MapPlaceholder } from '../../components/map/MapPlaceholder';
import { VenueSheet } from '../../components/venue/VenueSheet';
import { CitySelector } from '../../components/voting/CitySelector';

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

  // Height of the map/content area, measured so the bottom sheet can compute its
  // collapsed/expanded snap points relative to the actual available space.
  const [contentHeight, setContentHeight] = useState(0);
  const onContentLayout = (e: LayoutChangeEvent) => setContentHeight(e.nativeEvent.layout.height);

  const handleVenuePress = (venue: { id: string }) => router.push(`/venue/${venue.id}`);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-crawl-bg">
      {/* Fixed header — city, search, filters */}
      <View className="items-center pt-2">
        <CitySelector />
      </View>

      <View className="py-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilterPress={() => router.push('/filters')}
        />
      </View>

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

      {/* Content area — the map fills it as a full-height background; the venue sheet
          is layered over the bottom and drags between a peek and an expanded list. */}
      <View className="flex-1 overflow-hidden" onLayout={onContentLayout}>
        <View className="absolute inset-0">
          {hasNativeMaps ? (
            <CrawlMapView venues={filteredVenues} onVenuePress={handleVenuePress} />
          ) : (
            <MapPlaceholder venues={filteredVenues} onPinPress={handleVenuePress} />
          )}
        </View>

        {contentHeight > 0 && (
          <VenueSheet
            venues={filteredVenues}
            isLoading={isVenuesLoading}
            isError={isVenuesError}
            onRetry={refetchVenues}
            onResetFilters={resetFilters}
            onVenuePress={handleVenuePress}
            containerHeight={contentHeight}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
