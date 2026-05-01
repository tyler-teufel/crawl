import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  ensureSignedIn,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
} from '@/lib/auth';
import { setAuthToken } from '@/api/client';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

interface AuthContextValue {
  /** Supabase auth user. Null until the bootstrap sign-in completes. */
  user: User | null;
  /** True if the current user was created via signInAnonymously. */
  isAnonymous: boolean;
  /** True until the initial getSession + ensureSignedIn settles. */
  initializing: boolean;
  /** Foreground location captured during onboarding, or null if denied/skipped. */
  userLocation: UserLocation | null;
  setUserLocation: (loc: UserLocation | null) => void;
  /** Trigger Apple sign-in / link. iOS only. */
  linkApple: () => Promise<void>;
  /** Trigger Google sign-in / link. */
  linkGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readIsAnonymous(user: User | null): boolean {
  return (user as { is_anonymous?: boolean } | null)?.is_anonymous === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  // Bootstrap: read existing session, sign in anonymously if none.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = await ensureSignedIn();
        if (mounted) {
          setUser(u);
          const {
            data: { session },
          } = await supabase.auth.getSession();
          setAuthToken(session?.access_token ?? null);
        }
      } catch (err) {
        // In Expo Go without env vars, supabase calls will throw. Log and
        // leave user=null so the UI can still render the onboarding flow.
        if (__DEV__) {
          console.warn('[AuthContext] ensureSignedIn failed:', err);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const linkApple = useCallback(async () => {
    await signInWithApple();
    // onAuthStateChange will update `user`.
  }, []);

  const linkGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAnonymous: readIsAnonymous(user),
      initializing,
      userLocation,
      setUserLocation,
      linkApple,
      linkGoogle,
      signOut,
    }),
    [user, initializing, userLocation, linkApple, linkGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
