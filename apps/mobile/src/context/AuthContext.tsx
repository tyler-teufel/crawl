import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  ensureSignedIn,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
} from '@/lib/auth';
import { setAuthToken } from '@/api/client';
import { voteKeys } from '@/api/votes';
import { clearPersistedVoteState } from '@/api/voteStorage';
import { clearOnboardingFlag } from '@/lib/onboarding';

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
  const queryClient = useQueryClient();
  // Last user id seen by the auth listener, used to detect an identity swap.
  const userIdRef = useRef<string | null>(null);

  // Vote state is per-user but cached both in React Query (a long-lived,
  // always-mounted observer via VenueProvider) and — in mock mode — in
  // device-scoped AsyncStorage. Neither is keyed by user id, so signing in
  // with Apple over an anonymous session left the anonymous user's votes on
  // screen until a cast happened to invalidate them. Signing in with a native
  // id_token creates a NEW Supabase user rather than upgrading the anonymous
  // one, so an id change here is a genuine identity swap: drop the old user's
  // vote state instead of showing it to the new one.
  const resetVoteStateForNewUser = useCallback(async () => {
    await clearPersistedVoteState();
    await queryClient.resetQueries({ queryKey: voteKeys.all });
  }, [queryClient]);

  // Bootstrap: read existing session, sign in anonymously if none.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = await ensureSignedIn();
        if (mounted) {
          setUser(u);
          userIdRef.current = u.id;
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

      const nextUserId = session?.user?.id ?? null;
      if (userIdRef.current && nextUserId !== userIdRef.current) {
        void resetVoteStateForNewUser();
      }
      userIdRef.current = nextUserId;
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [resetVoteStateForNewUser]);

  const linkApple = useCallback(async () => {
    await signInWithApple();
    // onAuthStateChange will update `user`.
  }, []);

  const linkGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    // The onboarding flag outlives the session; leaving it set would let the
    // gate redirect the signed-out user straight back into the tabs.
    await clearOnboardingFlag();
    await resetVoteStateForNewUser();
  }, [resetVoteStateForNewUser]);

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
