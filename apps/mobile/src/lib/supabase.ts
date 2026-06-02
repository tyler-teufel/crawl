import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Whether a live Supabase backend is configured for this build. Callers that
// need real data (auth, venue reads) should branch on this; the app must still
// boot when it is false.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  // Do NOT throw here. This module is imported from the root layout's boot
  // chain (_layout → AuthContext → supabase), and a throw at module-evaluation
  // time crashes the app before React mounts, before any error boundary, and
  // before Sentry is initialized — an instant, unreported launch crash. Warn
  // instead and fall back to placeholders so imports resolve cleanly. Network
  // calls then fail at runtime where callers already handle it: AuthContext
  // swallows auth errors and venues/cities fall back to mock data.
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY — ' +
      'running without a live Supabase backend. Set them in apps/mobile/.env (local) ' +
      'or the EAS build environment so they are inlined into the bundle.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
