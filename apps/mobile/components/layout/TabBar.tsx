import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const tabs = [
  { name: '(tabs)/index', label: 'Explore', icon: 'compass' as const },
  { name: '(tabs)/voting', label: 'Voting', icon: 'heart' as const },
  { name: '(tabs)/global', label: 'Global', icon: 'globe' as const },
  { name: '(tabs)/profile', label: 'Profile', icon: 'person' as const },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row border-t border-crawl-card bg-crawl-bg"
      style={{ paddingBottom: insets.bottom }}>
      {tabs.map((tab, index) => {
        const isFocused = state.index === index;

        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            className="flex-1 items-center pb-1 pt-2">
            <View
              className={`mb-1 rounded-full px-4 py-1 ${isFocused ? 'bg-crawl-purple/20' : ''}`}>
              <Ionicons
                name={
                  isFocused
                    ? (tab.icon as keyof typeof Ionicons.glyphMap)
                    : (`${tab.icon}-outline` as keyof typeof Ionicons.glyphMap)
                }
                size={22}
                color={isFocused ? '#a855f7' : '#9ca3af'}
              />
            </View>
            <Text
              className={`text-xs ${isFocused ? 'font-semibold text-crawl-purple-light' : 'text-crawl-text-muted'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
