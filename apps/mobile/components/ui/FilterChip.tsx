import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/utils';

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
      className={cn(
        'mr-2 flex-row items-center rounded-full border px-4 py-2',
        active ? 'border-crawl-purple bg-crawl-purple' : 'border-crawl-border bg-crawl-surface'
      )}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={active ? '#fff' : '#8b8ba5'}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        className={cn(
          'font-sans-medium text-sm',
          active ? 'text-white' : 'text-crawl-text-secondary'
        )}>
        {label}
      </Text>
    </Pressable>
  );
}
