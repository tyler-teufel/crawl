import React, { useEffect } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Venue } from '@/types/venue';

interface MapPinProps {
  venue: Venue;
  style?: ViewStyle;
  onPress: () => void;
}

export function MapPin({ venue, style, onPress }: MapPinProps) {
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (venue.isTrending) {
      glowScale.value = withRepeat(
        withTiming(1.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [venue.isTrending, glowScale, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const pinColor = venue.isTrending ? '#7f13ec' : '#5b0daa';

  return (
    <Pressable style={style} onPress={onPress}>
      <View className="items-center justify-center">
        {venue.isTrending && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#7f13ec',
              },
              glowStyle,
            ]}
          />
        )}
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: pinColor }}>
          <Ionicons name="beer" size={18} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}
