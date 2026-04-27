import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Auth helpers for Crawl.
 *
 * The flow is anonymous-first: on app boot we ensure a Supabase session exists,
 * creating an anonymous user if none is persisted. Apple/Google login are layered
 * on top via identity linking — when an anonymous user provides an Apple or
 * Google id_token, supabase-js (v2.43+) upgrades the existing anonymous user
 * to a permanent identity rather than creating a new user. Their existing
 * votes/preferences/data carry over because the user UUID does not change.
 *
 * Native modules (expo-apple-authentication, @react-native-google-signin/google-signin)
 * are imported lazily so the JS bundle still boots in Expo Go, where these native
 * modules are unavailable. Calls to signInWithApple / signInWithGoogle in Expo Go
 * will throw a descriptive error rather than white-screen the app.
 */

declare const process: { env: Record<string, string | undefined> };

// ---------------------------------------------------------------------------
// Anonymous
// ---------------------------------------------------------------------------

/**
 * Ensure the current Supabase session is an authenticated user. If no session
 * is persisted in AsyncStorage, sign in anonymously. Returns the user.
 */
export async function ensureSignedIn() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('signInAnonymously returned no user');
  return data.user;
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

/**
 * Sign in with Apple. If an anonymous session already exists, supabase-js will
 * upgrade that user in-place (the user UUID is preserved). Otherwise a new
 * authed user is created.
 *
 * iOS only; throws on Android per App Store rule 4.8 — Apple is required when
 * any third-party login is offered on iOS, and there is no Apple flow on
 * Android worth supporting here.
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  // Lazy import so Expo Go (which lacks the native module) still boots.
  let AppleAuthentication: typeof import('expo-apple-authentication');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    AppleAuthentication = require('expo-apple-authentication');
  } catch {
    throw new Error('expo-apple-authentication native module is unavailable in this build.');
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple authentication is not available on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const idToken = credential.identityToken;
  if (!idToken) throw new Error('No identityToken returned from Apple.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;

  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    throw new Error(
      '@react-native-google-signin/google-signin native module is unavailable in this build.'
    );
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set.');
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId,
  });
  googleConfigured = true;
}

/**
 * Sign in with Google. Same anon-upgrade behavior as `signInWithApple`.
 */
export async function signInWithGoogle() {
  configureGoogle();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();

  // v14+ wraps the user in { type: 'success', data: { idToken, ... } }.
  // Older versions returned the user directly. Handle both shapes.
  const idToken: string | null =
    (result as { data?: { idToken?: string | null } })?.data?.idToken ??
    (result as { idToken?: string | null })?.idToken ??
    null;

  if (!idToken) throw new Error('No idToken returned from Google.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
