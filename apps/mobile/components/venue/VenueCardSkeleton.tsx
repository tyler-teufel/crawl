import React from 'react';
import { View } from 'react-native';
import { ELEVATION } from '@/lib/theme';
import { Skeleton } from '../ui/Skeleton';

interface Props {
  width: number;
}

/** Matches the photography-first `VenueCard` silhouette so loading→loaded swap is calm. */
export function VenueCardSkeleton({ width }: Props) {
  return (
    // Outer wrapper carries the elevation shadow + shape (NO overflow-hidden, which
    // would clip the drop shadow on iOS); inner view clips the hero corners.
    <View
      style={[{ width, maxHeight: 230 }, ELEVATION[1]]}
      className="mr-4 rounded-crawl-lg border border-crawl-border bg-crawl-card">
      <View className="overflow-hidden rounded-crawl-lg">
        {/* Hero */}
        <Skeleton className="h-24 w-full" />
        {/* Content */}
        <View className="p-3">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded" />
          <View className="mt-3 flex-row items-center justify-between">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-crawl-md" />
          </View>
        </View>
      </View>
    </View>
  );
}
