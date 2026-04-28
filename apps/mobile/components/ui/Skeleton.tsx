import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** Tailwind classes for sizing / shape (e.g. "h-4 w-32 rounded"). */
  className?: string;
}

/**
 * A pulsing block that signals "data is loading here." Designed to be
 * sized via NativeWind classes — no per-screen variants, just compose.
 *
 * Renders inside `<Animated.View>` so the opacity pulse runs on the UI
 * thread via Reanimated 3. Safe in Expo Go.
 */
export function Skeleton({ className }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View accessible={false} style={style} className={cn('bg-crawl-card', className)}>
      <View className="flex-1" />
    </Animated.View>
  );
}
