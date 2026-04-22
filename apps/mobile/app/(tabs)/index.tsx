import React, { useRef } from 'react';
import { View, FlatList, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVenueContext } from '@/context/VenueContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { FilterChip } from '../../components/ui/FilterChip';
import { CrawlMapView } from '../../components/map/CrawlMapView';
import { MapPlaceholder } from '../../components/map/MapPlaceholder';
import { VenueCard } from '../../components/venue/VenueCard';

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
  const insets = useSafeAreaInsets();
  const { filteredVenues, filters, toggleFilter, searchQuery, setSearchQuery } = useVenueContext();
  const flatListRef = useRef<FlatList>(null);

  const handleVenuePress = (venue: { id: string }) => router.push(`/venue/${venue.id}`);

  return (
    <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
      {/* Search */}
      <View className="py-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilterPress={() => router.push('/filters')}
        />
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-10 px-4">
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

      {/* Map */}
      <View className="flex-1">
        {hasNativeMaps ? (
          <CrawlMapView venues={filteredVenues} onVenuePress={handleVenuePress} />
        ) : (
          <MapPlaceholder venues={filteredVenues} onPinPress={handleVenuePress} />
        )}
      </View>

      {/* Bottom venue carousel */}
      <View className="pb-2">
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
      </View>
    </View>
  );
}
