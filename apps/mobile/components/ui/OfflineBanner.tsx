import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// netinfo is a native module; in Expo Go without a dev client it'll be
// missing. Probe at runtime so the banner becomes a no-op rather than
// crashing on import.
type NetInfoState = { isInternetReachable: boolean | null; isConnected: boolean | null };
type NetInfoModule = {
  addEventListener: (cb: (s: NetInfoState) => void) => () => void;
};

let netinfo: NetInfoModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  netinfo = require('@react-native-community/netinfo').default ?? null;
} catch {
  netinfo = null;
}

/**
 * Non-blocking banner pinned just under the status bar that surfaces
 * "you're offline" when NetInfo reports the device can't reach the
 * internet. Queries fail gracefully on their own — this is signal, not
 * a gate. Hidden when online, when NetInfo isn't installed, or before
 * the first event arrives (we don't assume offline).
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!netinfo) return;
    const unsub = netinfo.addEventListener((s) => {
      // `isInternetReachable` is the more truthful signal (DNS works);
      // fall back to `isConnected` while it's still resolving on cold start.
      const reachable = s.isInternetReachable ?? s.isConnected ?? true;
      setOffline(!reachable);
    });
    return unsub;
  }, []);

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{ paddingTop: insets.top }}
      className="absolute left-0 right-0 top-0 z-50 bg-red-500/90">
      <View className="flex-row items-center justify-center gap-2 px-4 py-2">
        <Ionicons name="cloud-offline" size={14} color="#ffffff" />
        <Text className="text-xs font-semibold text-white">
          You&apos;re offline. Showing cached results.
        </Text>
      </View>
    </View>
  );
}
