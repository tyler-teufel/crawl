import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '../ui/Skeleton';

/** Matches the rough silhouette of `VenueListItem` for the voting screen. */
export function VenueListItemSkeleton() {
  return (
    <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-crawl-card p-3">
      <Skeleton className="h-8 w-6 rounded" />
      <View className="flex-1">
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="mt-2 h-3 w-1/2 rounded" />
      </View>
      <Skeleton className="h-10 w-10 rounded-full" />
    </View>
  );
}
