import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-crawl-purple',
  secondary: 'border border-crawl-purple bg-transparent',
  tertiary: 'bg-transparent',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-crawl-purple-light',
  tertiary: 'text-crawl-purple-light',
};

const ICON_COLOR: Record<ButtonVariant, string> = {
  primary: '#ffffff',
  secondary: '#a855f7',
  tertiary: '#a855f7',
};

/**
 * Shared button from the v2 design system. Primary (filled purple),
 * Secondary (purple outline), Tertiary (ghost) — variants drive both the
 * container and label/icon color via `cn()` token merging.
 */
export function Button({ label, variant = 'primary', icon, className, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'flex-row items-center justify-center gap-1 rounded-crawl-md px-4 py-2 active:opacity-80',
        CONTAINER[variant],
        className
      )}
      {...props}>
      {icon ? <Ionicons name={icon} size={16} color={ICON_COLOR[variant]} /> : null}
      <Text className={cn('font-sans-bold text-sm', LABEL[variant])}>{label}</Text>
    </Pressable>
  );
}
