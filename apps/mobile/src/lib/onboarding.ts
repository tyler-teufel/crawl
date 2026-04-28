import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_KEY = 'crawl.firstLaunchComplete.v1';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
  return value === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
}
