import React, { useState } from 'react';
import { View, Text, Pressable, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ensureSignedIn } from '@/lib/auth';
import { markOnboardingComplete } from '@/lib/onboarding';

type Pending = 'apple' | 'google' | 'anon' | null;

/**
 * Onboarding auth screen. Three paths:
 * - Apple    (iOS only — required by App Store rule 4.8 whenever third-party
 *             login is offered)
 * - Google   (iOS + Android)
 * - Anonymous — creates an anon Supabase user; can be linked later from
 *             Profile.
 *
 * All three paths mark onboarding complete and route into (tabs).
 */
export default function OnboardingAuth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { linkApple, linkGoogle } = useAuth();
  const [pending, setPending] = useState<Pending>(null);

  const finish = async () => {
    await markOnboardingComplete();
    router.replace('/(tabs)');
  };

  const handleApple = async () => {
    setPending('apple');
    try {
      await linkApple();
      await finish();
    } catch (err) {
      Alert.alert('Sign in with Apple failed', (err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const handleGoogle = async () => {
    setPending('google');
    try {
      await linkGoogle();
      await finish();
    } catch (err) {
      Alert.alert('Sign in with Google failed', (err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const handleAnonymous = async () => {
    setPending('anon');
    try {
      await ensureSignedIn();
      await finish();
    } catch (err) {
      Alert.alert('Could not continue', (err as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <View
      className="flex-1 items-center justify-between bg-crawl-bg px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }}>
      <View className="items-center">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-crawl-purple/20">
          <Ionicons name="person" size={44} color="#a855f7" />
        </View>
        <Text className="mt-6 text-2xl font-bold text-white">Make it yours</Text>
        <Text className="mt-3 text-center text-base text-crawl-text-muted">
          Sign in to keep your votes and preferences across devices, or jump in anonymously and link
          an account later.
        </Text>
      </View>

      <View className="w-full gap-3">
        {Platform.OS === 'ios' ? (
          <ProviderButton
            iconName="logo-apple"
            label="Continue with Apple"
            onPress={handleApple}
            loading={pending === 'apple'}
            disabled={pending !== null}
            tone="white"
          />
        ) : null}

        <ProviderButton
          iconName="logo-google"
          label="Continue with Google"
          onPress={handleGoogle}
          loading={pending === 'google'}
          disabled={pending !== null}
          tone="white"
        />

        <Pressable
          onPress={handleAnonymous}
          disabled={pending !== null}
          className="mt-2 items-center rounded-2xl border border-crawl-purple/40 bg-crawl-card px-6 py-4 active:opacity-80 disabled:opacity-60">
          {pending === 'anon' ? (
            <ActivityIndicator color="#a855f7" />
          ) : (
            <Text className="text-base font-semibold text-crawl-purple-light">
              Continue anonymously
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ProviderButton({
  iconName,
  label,
  onPress,
  loading,
  disabled,
  tone,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  tone: 'white';
}) {
  const isWhite = tone === 'white';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={
        isWhite
          ? 'flex-row items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 active:opacity-80 disabled:opacity-60'
          : 'flex-row items-center justify-center gap-2 rounded-2xl bg-crawl-purple px-6 py-4 active:opacity-80 disabled:opacity-60'
      }>
      {loading ? (
        <ActivityIndicator color={isWhite ? '#0a0a0f' : '#fff'} />
      ) : (
        <>
          <Ionicons name={iconName} size={20} color={isWhite ? '#0a0a0f' : '#fff'} />
          <Text
            className={
              isWhite ? 'text-base font-semibold text-black' : 'text-base font-semibold text-white'
            }>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
