import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { updateDisplayName } from '@/lib/auth';
import { readProfileName } from '@/lib/displayName';
import { markOnboardingComplete } from '@/lib/onboarding';
import { StepDots } from '../../components/onboarding/StepDots';

const MAX_NAME_LENGTH = 32;

/**
 * Final onboarding step: the display name.
 *
 * Nothing upstream reliably supplies one — anonymous users have no profile at
 * all, and Sign in with Apple with "Hide My Email" gives only a
 * `@privaterelay.appleid.com` address, which the Profile screen was rendering
 * as the user's name. Asking once here is the only place a real name gets
 * captured. Skippable: the profile falls back to a generic label.
 *
 * This step marks onboarding complete for all three auth paths.
 */
export default function OnboardingName() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // Prefilled when the provider already gave us a name (Google's id_token, or
  // the Apple credential captured at first authorization).
  const [name, setName] = useState(() => readProfileName(user) ?? '');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    await markOnboardingComplete();
    router.replace('/(tabs)');
  };

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateDisplayName(trimmed);
      await finish();
    } catch (err) {
      Alert.alert('Could not save your name', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      className="flex-1 items-center justify-between bg-crawl-bg px-6"
      style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }}>
      <View className="w-full items-center gap-6">
        <View className="h-40 w-40 items-center justify-center rounded-full border border-crawl-border">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-crawl-purple/20">
            <Ionicons name="happy" size={44} color="#a855f7" />
          </View>
        </View>
        <View className="items-center gap-4">
          <Text className="font-display-bold text-3xl text-white">What should we call you?</Text>
          <Text className="text-center font-sans text-base leading-6 text-crawl-text-secondary">
            This is the name your crew sees. You can change it later.
          </Text>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#8b8ba5"
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          className="w-full rounded-crawl-lg border border-crawl-border bg-crawl-card px-4 py-4 text-center font-sans text-base text-white"
        />
      </View>

      <View className="w-full gap-8">
        <StepDots index={3} />
        <View>
          <Pressable
            onPress={handleContinue}
            disabled={saving || !name.trim()}
            className="items-center rounded-crawl-lg bg-crawl-purple px-6 py-4 active:opacity-80 disabled:opacity-60">
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-sans-bold text-base text-white">Continue</Text>
            )}
          </Pressable>
          <Pressable
            onPress={finish}
            disabled={saving}
            className="mt-3 items-center px-6 py-3 active:opacity-80">
            <Text className="font-sans-medium text-sm text-crawl-purple-light">Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
