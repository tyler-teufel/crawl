import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';

import { useVoting } from '../hooks/useVoting';
import { useBars } from '../hooks/useBars';
import NativeMap, { NativeMapHandle, MapRegion } from '../components/NativeMap';
import BarCard, { CARD_WIDTH, CARD_MARGIN, SNAP_INTERVAL } from '../components/BarCard';
import BarDetailSheet from '../components/BarDetailSheet';
import FilterBar from '../components/FilterBar';
import { BarWithScore, FilterType } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Default map region centred on the mock bar cluster (Midtown Manhattan). */
const DEFAULT_REGION = {
  latitude: 40.7579,
  longitude: -73.9862,
  latitudeDelta: 0.028,
  longitudeDelta: 0.028,
};

/**
 * Nightlife-themed dark map style.
 * Suppresses POI clutter so only bar/nightclub markers are prominent.
 */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4b5563' }] },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3f4f6' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
];

// ── React 19 ref compatibility wrapper ─────────────────────────────────────
//
// React 19 treats `ref` as a regular prop. ScrollView's types don't declare
// `ref` in their Props interface, causing TS errors when you write
// <ScrollView ref={...}>. This wrapper re-types it without changing runtime behaviour.

type WithRef<C extends React.ComponentType<object>, Instance> = React.ComponentType<
  React.ComponentProps<C> & { ref?: React.Ref<Instance> }
>;

const ScrollViewRef = ScrollView as WithRef<typeof ScrollView, ScrollView>;

// ── Screen ─────────────────────────────────────────────────────────────────

/**
 * MapScreen – the sole screen of the Crawl app.
 *
 * Layout (bottom-up z-stack):
 *   1. Full-screen MapView with custom dark style
 *   2. Transparent header overlay  (app name + vote counter + filter bar)
 *   3. Transparent bottom panel    (horizontal bar card carousel)
 *   4. BarDetailSheet              (modal slide-up on card tap)
 */
export default function MapScreen() {
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  const mapRef = useRef<NativeMapHandle>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { voteState, vote, isLoading: isVoteLoading } = useVoting();
  const bars = useBars(voteState, filter);
  const selectedBar = bars.find((b) => b.id === selectedBarId) ?? null;

  // ── Location permission ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        // TODO: Animate map to user's real location once bars are location-aware.
      }
    })();
  }, []);

  // ── Interaction handlers ────────────────────────────────────────────────

  /**
   * Fired when the user taps a map marker.
   * Centres the map on the bar (with a slight south offset so the bottom
   * carousel doesn't overlap the marker) and scrolls the carousel to match.
   */
  const handleMarkerPress = useCallback(
    (bar: BarWithScore) => {
      setSelectedBarId(bar.id);

      mapRef.current?.animateToRegion(
        {
          latitude: bar.latitude - 0.007,
          longitude: bar.longitude,
          latitudeDelta: 0.016,
          longitudeDelta: 0.016,
        },
        450
      );

      const index = bars.findIndex((b) => b.id === bar.id);
      if (index >= 0) {
        scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
      }
    },
    [bars]
  );

  /**
   * Fired when the user taps a bar card in the bottom carousel.
   * Selects the bar, centres the map, and opens the full detail sheet.
   */
  const handleCardPress = useCallback((bar: BarWithScore) => {
    setSelectedBarId(bar.id);
    setIsDetailVisible(true);

    mapRef.current?.animateToRegion(
      {
        latitude: bar.latitude - 0.007,
        longitude: bar.longitude,
        latitudeDelta: 0.016,
        longitudeDelta: 0.016,
      },
      450
    );
  }, []);

  /**
   * Cast a vote for a bar.
   * Called both from the inline card button and the full detail sheet.
   */
  const handleVote = useCallback(
    async (barId: string) => {
      await vote(barId);
    },
    [vote]
  );

  /**
   * Inline vote handler from the carousel card (sets selection then votes).
   */
  const handleCardVote = useCallback(
    async (bar: BarWithScore) => {
      setSelectedBarId(bar.id);
      await vote(bar.id);
    },
    [vote]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  if (isVoteLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>🔥 CRAWL</Text>
        <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── 1. Full-screen map ─────────────────────────────────────── */}
      <NativeMap
        ref={mapRef}
        bars={bars}
        selectedBarId={selectedBarId}
        locationGranted={locationGranted}
        onMarkerPress={handleMarkerPress}
        initialRegion={DEFAULT_REGION}
        customMapStyle={DARK_MAP_STYLE}
        mapPadding={{ top: 130, right: 0, bottom: 180, left: 0 }}
      />

      {/* ── 2. Header overlay ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.appName}>🔥 CRAWL</Text>
          <View style={styles.voteCounter}>
            <Text style={styles.voteCounterText}>
              {voteState.votesRemaining}{' '}
              {voteState.votesRemaining === 1 ? 'vote' : 'votes'} left today
            </Text>
          </View>
        </View>
        <FilterBar filter={filter} onFilterChange={setFilter} />
      </View>

      {/* ── 3. Bottom carousel ─────────────────────────────────────── */}
      <View style={styles.bottomPanel}>
        <Text style={styles.carouselHint}>
          {bars.length} spot{bars.length !== 1 ? 's' : ''} nearby · tap to explore
        </Text>
        <ScrollViewRef
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          snapToAlignment="center"
        >
          {bars.map((bar) => (
            <BarCard
              key={bar.id}
              bar={bar}
              isSelected={selectedBarId === bar.id}
              onPress={() => handleCardPress(bar)}
              votesRemaining={voteState.votesRemaining}
              onVote={() => handleCardVote(bar)}
            />
          ))}
          {/* Right edge padding so the last card can fully snap to centre */}
          <View style={{ width: (SCREEN_WIDTH - CARD_WIDTH) / 2 - CARD_MARGIN }} />
        </ScrollViewRef>
      </View>

      {/* ── 4. Detail modal ────────────────────────────────────────── */}
      <BarDetailSheet
        bar={selectedBar}
        visible={isDetailVisible}
        onClose={() => setIsDetailVisible(false)}
        onVote={handleVote}
        voteState={voteState}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },

  // ── Splash / loading screen ────────────────────────────────────
  splash: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : STATUS_BAR_HEIGHT + 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(10, 15, 30, 0.88)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42, 53, 80, 0.5)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  voteCounter: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  voteCounterText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Bottom panel ──────────────────────────────────────────────
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingTop: 12,
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(42, 53, 80, 0.5)',
  },
  carouselHint: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    paddingHorizontal: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingLeft: (SCREEN_WIDTH - CARD_WIDTH) / 2 - CARD_MARGIN,
  },
});
