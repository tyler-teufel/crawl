import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BarWithScore } from '../types';

interface Props {
  bar: BarWithScore;
  isSelected: boolean;
  onPress: () => void;
}

/**
 * Custom map marker rendered inside a react-native-maps <Marker> callout.
 * Visual heat colour changes based on the bar's popularity score:
 *   80–100 → red (🔥 super hot)
 *   60–79  → amber (warm)
 *   40–59  → purple (moderate)
 *   0–39   → grey (cool)
 */
export default function BarMarker({ bar, isSelected, onPress }: Props) {
  const color = scoreToColor(bar.popularityScore);

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.9}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: color, borderColor: isSelected ? '#FFFFFF' : 'transparent' },
          isSelected && styles.selectedBubble,
        ]}
      >
        <Text style={styles.scoreText}>{bar.popularityScore}</Text>
        <Text style={styles.nameText} numberOfLines={1}>
          {bar.name}
        </Text>
      </View>
      {/* Callout arrow pointing down */}
      <View style={[styles.arrow, { borderTopColor: color }]} />
    </TouchableOpacity>
  );
}

function scoreToColor(score: number): string {
  if (score >= 80) return '#EF4444';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#8B5CF6';
  return '#6B7280';
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 76,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedBubble: {
    transform: [{ scale: 1.12 }],
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 80,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
