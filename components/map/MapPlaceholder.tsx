import React from 'react';
import { View } from 'react-native';
import { Venue } from '@/types/venue';
import { MapPin } from './MapPin';
import { MapControls } from './MapControls';

interface MapPlaceholderProps {
  venues: Venue[];
  onPinPress: (venue: Venue) => void;
}

// Maps venue positions to percentages on the placeholder
function getPosition(index: number): { top: string; left: string } {
  const positions = [
    { top: '25%', left: '35%' },
    { top: '40%', left: '65%' },
    { top: '55%', left: '25%' },
    { top: '30%', left: '75%' },
    { top: '65%', left: '50%' },
    { top: '45%', left: '15%' },
    { top: '35%', left: '55%' },
    { top: '60%', left: '70%' },
  ];
  return positions[index % positions.length];
}

export function MapPlaceholder({ venues, onPinPress }: MapPlaceholderProps) {
  return (
    <View className="flex-1 bg-crawl-bg">
      {/* Dark map background with subtle grid */}
      <View className="absolute inset-0 bg-crawl-surface opacity-50" />

      {/* Grid lines for map feel */}
      {[...Array(8)].map((_, i) => (
        <View
          key={`h-${i}`}
          className="absolute h-px w-full bg-crawl-card"
          style={{ top: `${(i + 1) * 12}%` }}
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <View
          key={`v-${i}`}
          className="absolute top-0 h-full w-px bg-crawl-card"
          style={{ left: `${(i + 1) * 16}%` }}
        />
      ))}

      {/* Venue pins */}
      {venues.map((venue, index) => {
        const pos = getPosition(index);
        return (
          <MapPin
            key={venue.id}
            venue={venue}
            style={{ position: 'absolute', top: pos.top, left: pos.left }}
            onPress={() => onPinPress(venue)}
          />
        );
      })}

      <MapControls />
    </View>
  );
}
