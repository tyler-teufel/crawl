/**
 * Real map powered by react-native-maps.
 *
 * Setup (one-time after npm install):
 *   1. Run `npx expo install react-native-maps` to pin the Expo-compatible version.
 *   2. Run `npm run prebuild` (or `expo prebuild`) to generate native iOS/Android code.
 *   3. iOS: add `NSLocationWhenInUseUsageDescription` to ios/<app>/Info.plist.
 *   4. Android: Google Maps API key is not required for basic tile rendering on Android 12+.
 *
 * If react-native-maps isn't installed yet, the app falls back to MapPlaceholder.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Venue } from '@/types/venue';
import { getRegionForCity, type RegionCity } from '@/lib/mapRegion';

// Conditional import so the app still launches without the native module installed
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
} catch {
  // react-native-maps not installed — MapPlaceholder will be used instead
}

interface CrawlMapViewProps {
  venues: Venue[];
  /** The selected city, used to frame the camera. Null only until `useCities()` resolves it. */
  city: RegionCity | null;
  onVenuePress: (venue: Venue) => void;
}

// Shown only until the selected city's row loads from `useCities()` — not a
// reaction to the venue list being empty (see `getRegionForCity`, #166).
const FALLBACK_REGION = {
  latitude: 35.2271,
  longitude: -80.8431,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function CrawlMapView({ venues, city, onVenuePress }: CrawlMapViewProps) {
  const mapRef = useRef<any>(null);

  // `animateToRegion` (imperative, via ref) rather than a controlled `region`
  // prop: a controlled region is reasserted on every render, which fights
  // the user's own panning/pinching mid-gesture. Driving the camera through
  // an effect keyed on the city lets it move only when the city actually
  // changes.
  useEffect(() => {
    if (!city) return;
    mapRef.current?.animateToRegion(getRegionForCity(city), 500);
  }, [city]);

  if (!MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Map unavailable — run `npx expo install react-native-maps` then `npm run prebuild`
        </Text>
      </View>
    );
  }

  const initialRegion = city ? getRegionForCity(city) : FALLBACK_REGION;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      userInterfaceStyle="dark">
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
          pinColor="#a855f7">
          <Callout onPress={() => onVenuePress(venue)} tooltip={false}>
            <Pressable style={styles.callout} onPress={() => onVenuePress(venue)}>
              <Text style={styles.calloutName} numberOfLines={1}>
                {venue.name}
              </Text>
              <Text style={styles.calloutType}>{venue.primaryType}</Text>
            </Pressable>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f13',
    padding: 24,
  },
  fallbackText: { color: '#8b8ba5', textAlign: 'center', fontSize: 13 },
  callout: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 8,
    minWidth: 140,
    maxWidth: 200,
  },
  calloutName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  calloutType: { color: '#a855f7', fontSize: 12, marginTop: 2 },
});
