import React from 'react';
import { View } from 'react-native';

export const ONBOARDING_STEPS = 4;

/**
 * Progress dots for the onboarding flow. Every step renders these — the
 * welcome screen used to be the only one that did, which read as "one page"
 * and left the remaining steps looking unrelated.
 */
export function StepDots({ index, total = ONBOARDING_STEPS }: { index: number; total?: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          className={`h-2 w-2 rounded-full ${
            i === index ? 'bg-crawl-purple-light' : 'bg-crawl-border'
          }`}
        />
      ))}
    </View>
  );
}
