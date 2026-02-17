import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { FilterType } from '../types';

interface FilterOption {
  label: string;
  value: FilterType;
  icon: string;
}

const FILTERS: FilterOption[] = [
  { label: 'All', value: 'all', icon: '🗺️' },
  { label: 'Bars', value: 'bar', icon: '🍺' },
  { label: 'Clubs', value: 'nightclub', icon: '🎵' },
  { label: 'Lounges', value: 'lounge', icon: '🥂' },
  { label: 'Sports', value: 'sports_bar', icon: '🏈' },
];

interface Props {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

/**
 * Horizontally scrollable filter chip row displayed below the app header.
 * Selecting a chip filters the map markers and the bottom card carousel.
 */
export default function FilterBar({ filter, onFilterChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {FILTERS.map((item) => {
        const active = filter === item.value;
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onFilterChange(item.value)}
            activeOpacity={0.75}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 34, 53, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(42, 53, 80, 0.9)',
  },
  activeChip: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  icon: {
    fontSize: 13,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});
