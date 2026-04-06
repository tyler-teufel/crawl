import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FilterChipProps {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}

export function FilterChip({ label, icon, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 flex-row items-center rounded-full px-4 py-2 ${
        active ? 'bg-crawl-purple' : 'bg-crawl-card'
      }`}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={active ? '#fff' : '#9ca3af'}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-crawl-text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
