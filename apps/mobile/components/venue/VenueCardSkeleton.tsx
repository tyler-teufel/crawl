import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '../ui/Skeleton';

interface Props {
  width: number;
}

/** Matches the rough silhouette of `VenueCard` so loading→loaded swap is calm. */
export function VenueCardSkeleton({ width }: Props) {
  return (
    <View
      style={{ width }}
      className="mr-4 overflow-hidden rounded-2xl bg-crawl-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded" />
        </View>
        <Skeleton className="h-12 w-12 rounded-full" />
      </View>
      <Skeleton className="mt-4 h-3 w-full rounded" />
      <Skeleton className="mt-2 h-3 w-5/6 rounded" />
      <View className="mt-4 flex-row gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </View>
    </View>
  );
}
