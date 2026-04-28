import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BaseProps {
  title: string;
  message?: string;
  /** Optional retry handler. When omitted, no button is rendered. */
  onRetry?: () => void;
  retryLabel?: string;
}

interface ErrorStateProps extends BaseProps {
  /** Override the default error icon. */
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Shown when a query failed (network error, server error, missing data).
 * Always offers a retry path when one is provided.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  icon = 'cloud-offline-outline',
}: ErrorStateProps) {
  return (
    <View className="items-center justify-center px-8 py-12">
      <Ionicons name={icon} size={36} color="#9ca3af" />
      <Text className="mt-3 text-center text-base font-semibold text-white">{title}</Text>
      {message ? (
        <Text className="mt-1 text-center text-sm text-crawl-text-muted">{message}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-crawl-purple px-5 py-2 active:opacity-80">
          <Text className="text-sm font-semibold text-white">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface EmptyStateProps extends BaseProps {
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Shown when a query succeeded but returned zero results — e.g. filters
 * exclude every venue, or the city has no venues yet. Distinct from
 * ErrorState semantically (no failure occurred).
 */
export function EmptyState({
  title,
  message,
  onRetry,
  retryLabel = 'Reset',
  icon = 'compass-outline',
}: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-8 py-12">
      <Ionicons name={icon} size={36} color="#9ca3af" />
      <Text className="mt-3 text-center text-base font-semibold text-white">{title}</Text>
      {message ? (
        <Text className="mt-1 text-center text-sm text-crawl-text-muted">{message}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-crawl-card px-5 py-2 active:opacity-80">
          <Text className="text-sm font-semibold text-white">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
