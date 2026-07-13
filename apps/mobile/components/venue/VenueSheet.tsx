import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, Animated, PanResponder, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Venue } from '@/types/venue';
import { ELEVATION } from '@/lib/theme';
import { VenueCard } from './VenueCard';
import { VenueCardSkeleton } from './VenueCardSkeleton';
import { ErrorState, EmptyState } from '../ui/States';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

// Visible sheet height when collapsed (drag handle + a peek of the first card).
const PEEK_HEIGHT = 148;
// Map kept visible above the sheet when fully expanded, so the map never fully
// disappears (preserves the #47 "map always usable" guarantee).
const TOP_GAP = 64;

interface VenueSheetProps {
  venues: Venue[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onResetFilters: () => void;
  onVenuePress: (venue: Venue) => void;
  /** Height of the parent (the map/content area) — measured via onLayout upstream. */
  containerHeight: number;
}

/**
 * Drag-to-collapse bottom sheet for the Explore venue list, layered over the map.
 *
 * Built on RN's built-in `Animated` + `PanResponder` (no `react-native-gesture-handler`
 * / `@gorhom/bottom-sheet`) so the whole interaction stays pure-JS and OTA-deliverable —
 * see DESIGN_DECISIONS. Two snap points: collapsed (a peek so the map dominates) and
 * expanded (the list scrolls). The drag is anchored to the header handle only, so the
 * map keeps its own pan/zoom and the list keeps its own scroll — they never fight the sheet.
 */
export function VenueSheet({
  venues,
  isLoading,
  isError,
  onRetry,
  onResetFilters,
  onVenuePress,
  containerHeight,
}: VenueSheetProps) {
  const insets = useSafeAreaInsets();

  const { expandedY, collapsedY } = useMemo(() => {
    const expanded = TOP_GAP;
    const collapsed = Math.max(containerHeight - PEEK_HEIGHT, TOP_GAP);
    return { expandedY: expanded, collapsedY: collapsed };
  }, [containerHeight]);

  // translateY within the sheet's own (containerHeight-tall) box: 0 = fully covering
  // the content area, containerHeight = fully off the bottom. Start off-screen until
  // the parent has been measured, then settle to the collapsed peek.
  const translateY = useRef(new Animated.Value(9999)).current;
  const dragStartY = useRef(collapsedY);
  const [expanded, setExpanded] = useState(false);

  const snapTo = (to: number) => {
    Animated.spring(translateY, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 2,
      speed: 16,
    }).start();
    setExpanded(to === expandedY);
  };

  // Settle to the collapsed peek once the container is measured (or its bounds change).
  useEffect(() => {
    if (containerHeight > 0) {
      translateY.setValue(collapsedY);
      dragStartY.current = collapsedY;
      setExpanded(false);
    }
  }, [containerHeight, collapsedY, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          // stopAnimation hands back the live value so mid-flight drags feel continuous.
          translateY.stopAnimation((value) => {
            dragStartY.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(Math.max(dragStartY.current + g.dy, expandedY), collapsedY);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const pos = dragStartY.current + g.dy;
          const midpoint = (expandedY + collapsedY) / 2;
          let target: number;
          if (g.vy < -0.5)
            target = expandedY; // fast fling up → expand
          else if (g.vy > 0.5)
            target = collapsedY; // fast fling down → collapse
          else target = pos < midpoint ? expandedY : collapsedY;
          snapTo(target);
        },
      }),
    // snapTo/setExpanded are stable enough; bounds are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedY, collapsedY, translateY]
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View className="px-4 pt-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="mb-3">
              <VenueCardSkeleton width={CARD_WIDTH} />
            </View>
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <ErrorState
          title="Couldn't load venues"
          message="Check your connection and try again."
          onRetry={onRetry}
        />
      );
    }
    if (venues.length === 0) {
      return (
        <EmptyState
          title="No venues match your filters"
          message="Try clearing a chip or switching cities."
          onRetry={onResetFilters}
          retryLabel="Clear filters"
        />
      );
    }
    return (
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: insets.bottom + 16,
        }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <VenueCard venue={item} width={CARD_WIDTH} onPress={() => onVenuePress(item)} />
        )}
      />
    );
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: containerHeight,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          transform: [{ translateY }],
        },
        ELEVATION[3],
      ]}
      className="border-t border-crawl-border bg-crawl-card">
      {/* Drag handle / header — the ONLY element wired to the pan responder */}
      <View {...panResponder.panHandlers} className="items-center px-4 pb-2 pt-3">
        <View className="h-1 w-10 rounded-full bg-crawl-border" />
        <View className="mt-2 w-full flex-row items-center justify-between">
          <Text className="font-display-bold text-base text-white">Nearby</Text>
          {!isLoading && !isError && (
            <Text className="font-sans text-xs text-crawl-text-muted">
              {venues.length} {venues.length === 1 ? 'spot' : 'spots'}
              {expanded ? '' : ' · drag up'}
            </Text>
          )}
        </View>
      </View>

      {/* Body fills the rest of the sheet; the list scrolls independently of the drag */}
      <View className="flex-1">{renderBody()}</View>
    </Animated.View>
  );
}
