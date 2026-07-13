import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

type BadgeVariant = 'trending' | 'open' | 'live' | 'closed';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANT: Record<BadgeVariant, { container: string; text: string; icon?: string }> = {
  trending: {
    container: 'border-crawl-purple/40 bg-crawl-purple/15',
    text: 'text-white',
    icon: '🔥',
  },
  live: { container: 'border-crawl-purple/40 bg-crawl-purple/15', text: 'text-white', icon: '🎵' },
  open: { container: 'border-crawl-green/40 bg-crawl-green/15', text: 'text-crawl-green' },
  closed: { container: 'border-crawl-border bg-crawl-surface', text: 'text-crawl-text-muted' },
};

export function Badge({ label, variant = 'trending' }: BadgeProps) {
  const styles = VARIANT[variant];

  return (
    <View className={cn('flex-row items-center rounded-full border px-2 py-0.5', styles.container)}>
      {styles.icon ? <Text className="mr-1 text-[10px]">{styles.icon}</Text> : null}
      <Text className={cn('font-sans-bold text-[10px] uppercase tracking-wide', styles.text)}>
        {label}
      </Text>
    </View>
  );
}
