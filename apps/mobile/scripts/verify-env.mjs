#!/usr/bin/env node
// Prints the EXPO_PUBLIC_* config matrix for a build and, for a given delivery
// mode, fails if a required var is missing. Run in CI / release builds so a
// misconfiguration is a visible pipeline signal instead of a silent runtime gap
// (the app itself never blocks on this — it degrades gracefully).
//
// Usage: node scripts/verify-env.mjs [--mode mock|supabase|api]
//   mock     (default) no backend required — app runs on bundled data
//   supabase auth + direct Supabase reads
//   api      full Railway API (also needs Supabase for auth)

const KEYS = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
];

const REQUIRED = {
  mock: [],
  supabase: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY'],
  api: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY', 'EXPO_PUBLIC_API_URL'],
};

const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex !== -1 ? process.argv[modeIndex + 1] : 'mock';

const isSet = (key) => {
  const value = process.env[key];
  return typeof value === 'string' && value.length > 0;
};

console.log(`\nEXPO_PUBLIC_* config matrix (mode: ${mode})`);
for (const key of KEYS) {
  console.log(`  ${isSet(key) ? 'set   ' : 'unset '} ${key}`);
}

const required = REQUIRED[mode];
if (!required) {
  console.error(`\nUnknown mode "${mode}". Use one of: ${Object.keys(REQUIRED).join(', ')}`);
  process.exit(2);
}

const missing = required.filter((key) => !isSet(key));
if (missing.length > 0) {
  console.error(`\nMissing required env for mode "${mode}": ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`\nEnv OK for mode "${mode}".`);
