import React, { useRef, useImperativeHandle } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';

import type { BarWithScore } from '../types';
import BarMarker from './BarMarker';

// ── Conditional import of react-native-maps ─────────────────────────────────
//
// react-native-maps requires a native module (RNMapsAirModule) that is NOT
// bundled in Expo Go for SDK 47+. A static `import` would call
// TurboModuleRegistry.getEnforcing synchronously and throw before the screen
// component can mount, producing the "missing default export" error in the router.
//
// Wrapping in require() + try/catch intercepts the synchronous throw so the
// module loads successfully in both Expo Go (placeholder) and dev builds (real map).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mapsLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mapsLib = require('react-native-maps');
} catch {
  // Expo Go – react-native-maps native module unavailable.
}

const RNMapView = mapsLib?.default ?? null;
const RNMarker = mapsLib?.Marker ?? null;
const PROVIDER_GOOGLE = mapsLib?.PROVIDER_GOOGLE;

// ── Public types ─────────────────────────────────────────────────────────────

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Imperative handle exposed via ref so MapScreen can call animateToRegion. */
export interface NativeMapHandle {
  animateToRegion: (region: MapRegion, duration?: number) => void;
}

interface NativeMapProps {
  bars: BarWithScore[];
  selectedBarId: string | null;
  locationGranted: boolean;
  onMarkerPress: (bar: BarWithScore) => void;
  customMapStyle?: object[];
  initialRegion: MapRegion;
  mapPadding?: { top: number; right: number; bottom: number; left: number };
}

// ── Component ────────────────────────────────────────────────────────────────

const NativeMap = React.forwardRef<NativeMapHandle, NativeMapProps>(
  (
    {
      bars,
      selectedBarId,
      locationGranted,
      onMarkerPress,
      customMapStyle,
      initialRegion,
      mapPadding,
    },
    ref
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: MapRegion, duration = 450) => {
        internalRef.current?.animateToRegion(region, duration);
      },
    }));

    // ── Expo Go fallback ───────────────────────────────────────────────────
    if (!RNMapView) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🗺️</Text>
          <Text style={styles.placeholderTitle}>Map requires a dev build</Text>
          <Text style={styles.placeholderBody}>
            Run{' '}
            <Text style={styles.placeholderCode}>npx expo run:ios</Text>
            {' '}or{' '}
            <Text style={styles.placeholderCode}>npx expo run:android</Text>
            {'\n'}to enable Google Maps.{'\n'}Cards, voting, and filters work below.
          </Text>
        </View>
      );
    }

    // ── Real map (dev build / production) ─────────────────────────────────
    return (
      <RNMapView
        ref={internalRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        customMapStyle={customMapStyle}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={mapPadding}
      >
        {bars.map((bar) => (
          <RNMarker
            key={bar.id}
            coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
            onPress={() => onMarkerPress(bar)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <BarMarker
              bar={bar}
              isSelected={selectedBarId === bar.id}
              onPress={() => onMarkerPress(bar)}
            />
          </RNMarker>
        ))}
      </RNMapView>
    );
  }
);

NativeMap.displayName = 'NativeMap';
export default NativeMap;

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  placeholderIcon: {
    fontSize: 52,
  },
  placeholderTitle: {
    color: '#F59E0B',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholderBody: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  placeholderCode: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});
