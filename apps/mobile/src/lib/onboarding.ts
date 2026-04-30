import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_KEY = 'crawl.firstLaunchComplete.v1';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
  return value === '1';
}

const listeners = new Set<() => void>();

// Subscribers are notified after markOnboardingComplete writes to
// AsyncStorage. The OnboardingGate uses this to re-read the flag without
// having to poll on every render.
export function subscribeToOnboardingStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
  listeners.forEach((listener) => listener());
}
