# Maps SDK Integration Guide

Step-by-step plan for replacing the `MapPlaceholder` component with a real interactive map using `react-native-maps`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EXPLORE SCREEN                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 SearchBar + Chips                   │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              react-native-maps                     │  │
│  │              <MapView>                             │  │
│  │                                                    │  │
│  │    ┌─────────────────────────────┐                 │  │
│  │    │  <Marker coordinate={...}>  │                 │  │
│  │    │    <MapPin venue={v} />     │◄── custom view  │  │
│  │    │  </Marker>                  │    inside Marker │  │
│  │    └─────────────────────────────┘                 │  │
│  │                                                    │  │
│  │    onRegionChange ──► update visible venues        │  │
│  │    onMarkerPress  ──► scroll carousel to venue     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │              VenueCard Carousel                    │  │
│  │   onScroll ──► animate map to venue coordinates    │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Bi-Directional Sync

```
     MapView                    Carousel
        │                          │
        │  onMarkerPress(venue)    │  onSnapToItem(venue)
        ▼                          ▼
   ┌──────────────────────────────────┐
   │  selectedVenueId (shared state) │
   └──────────────────────────────────┘
        │                          │
        ▼                          ▼
   animateToRegion()         scrollToIndex()
```

---

## Step 1: Install

```bash
npx expo install react-native-maps
```

This requires a development build — `react-native-maps` has native modules that don't work in Expo Go. Set up EAS Build or local prebuild:

```bash
npx expo prebuild
```

## Step 2: API Keys

### Google Maps (Android)

Add to `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

### Apple Maps (iOS)

Works by default on iOS — no API key needed.

### Google Maps on iOS (optional)

If you prefer Google Maps on iOS for consistency:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_GOOGLE_MAPS_API_KEY"
      }
    }
  }
}
```

## Step 3: Create `components/map/VenueMap.tsx`

The new component should accept the same interface as `MapPlaceholder`:

```typescript
import React, { useRef, useEffect } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Platform } from 'react-native';
import { Venue } from '@/types/venue';
import { MapPin } from './MapPin';
import { MapControls } from './MapControls';

interface VenueMapProps {
  venues: Venue[];
  onPinPress: (venue: Venue) => void;
  selectedVenueId?: string;
  onRegionChange?: (region: Region) => void;
}

// Austin, TX center coordinates
const INITIAL_REGION: Region = {
  latitude: 30.2672,
  longitude: -97.7431,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function VenueMap({ venues, onPinPress, selectedVenueId, onRegionChange }: VenueMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (selectedVenueId && mapRef.current) {
      const venue = venues.find(v => v.id === selectedVenueId);
      if (venue) {
        mapRef.current.animateToRegion({
          latitude: venue.latitude,
          longitude: venue.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    }
  }, [selectedVenueId, venues]);

  return (
    <>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={INITIAL_REGION}
        customMapStyle={darkMapStyle}
        onRegionChangeComplete={onRegionChange}
      >
        {venues.map(venue => (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
            onPress={() => onPinPress(venue)}
          >
            <MapPin venue={venue} onPress={() => {}} />
          </Marker>
        ))}
      </MapView>
      <MapControls />
    </>
  );
}

// Dark map style — paste from https://snazzymaps.com or Google's Styling Wizard
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0f' }] },
  // ... additional style entries for roads, water, parks, etc.
];
```

### Key Implementation Notes

- **Dark map style**: Use a JSON style array from Snazzy Maps or Google's Styling Wizard. Match the `crawl-bg` (#0a0a0f) for the map background.
- **Custom marker views**: The existing `MapPin` component renders inside `<Marker>`. The pulsing glow animation from reanimated will work inside markers on Android. On iOS, you may need to set `tracksViewChanges={false}` after the initial render for performance.
- **MapControls**: The existing component is already positioned absolute bottom-right. Wire up the zoom buttons to `mapRef.current.animateToRegion()` with adjusted `latitudeDelta`/`longitudeDelta`.

## Step 4: Swap in Explore Screen

In `app/(tabs)/index.tsx`, change one import:

```typescript
// Before
import { MapPlaceholder } from '../../components/map/MapPlaceholder';

// After
import { VenueMap } from '../../components/map/VenueMap';
```

And update the JSX:

```tsx
// Before
<MapPlaceholder venues={filteredVenues} onPinPress={(venue) => router.push(`/venue/${venue.id}`)} />

// After
<VenueMap
  venues={filteredVenues}
  onPinPress={(venue) => router.push(`/venue/${venue.id}`)}
  selectedVenueId={selectedVenueId}
  onRegionChange={handleRegionChange}
/>
```

## Step 5: Bi-Directional Sync

Add a `selectedVenueId` state to coordinate map and carousel:

```typescript
const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

// When a map marker is tapped → scroll carousel
const handlePinPress = (venue: Venue) => {
  setSelectedVenueId(venue.id);
  const index = filteredVenues.findIndex((v) => v.id === venue.id);
  if (index >= 0) {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }
};

// When the carousel snaps to a new card → animate map
const handleCarouselScroll = (event) => {
  const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + 16));
  const venue = filteredVenues[index];
  if (venue) {
    setSelectedVenueId(venue.id);
  }
};
```

## Step 6: Keep MapPlaceholder as Fallback

Don't delete `MapPlaceholder.tsx`. It remains useful for:

- Development in Expo Go (no native modules)
- Web builds where react-native-maps isn't supported
- Testing UI layout without map rendering overhead

Consider a conditional swap:

```typescript
const MapComponent = Platform.select({
  web: MapPlaceholder,
  default: VenueMap,
});
```
