/**
 * app.config.js – Dynamic Expo configuration
 *
 * Expo loads this file on top of app.json (passed in as `config`).
 * Google Maps API keys are injected here from environment variables so
 * they are never committed to source control.
 *
 * ── Local development ──────────────────────────────────────────────────────
 * Copy .env.example → .env and fill in your keys.
 * Expo CLI automatically loads .env before evaluating this file.
 *
 * ── CI / EAS Build ─────────────────────────────────────────────────────────
 * Set the variables as EAS Secrets (eas secret:create) or in the
 * "env" block of your eas.json build profile. They are read here at
 * build time and embedded into the native project – they are NOT
 * bundled into the JavaScript layer.
 *
 *   eas.json example:
 *   {
 *     "build": {
 *       "production": {
 *         "env": {
 *           "GOOGLE_MAPS_API_KEY_IOS":     "...",
 *           "GOOGLE_MAPS_API_KEY_ANDROID": "..."
 *         }
 *       }
 *     }
 *   }
 */

const iosKey = process.env.GOOGLE_MAPS_API_KEY_IOS;
const androidKey = process.env.GOOGLE_MAPS_API_KEY_ANDROID;

if (!iosKey) {
  console.warn(
    '\n[app.config] ⚠️  GOOGLE_MAPS_API_KEY_IOS is not set.\n' +
      '   Copy .env.example → .env and add your key.\n' +
      '   Google Maps will not load on iOS until this is configured.\n'
  );
}
if (!androidKey) {
  console.warn(
    '\n[app.config] ⚠️  GOOGLE_MAPS_API_KEY_ANDROID is not set.\n' +
      '   Copy .env.example → .env and add your key.\n' +
      '   Google Maps will not load on Android until this is configured.\n'
  );
}

/** @param {{ config: import('@expo/config-types').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      // Embeds the key into Info.plist at prebuild time.
      // Required for PROVIDER_GOOGLE on iOS.
      googleMapsApiKey: iosKey ?? '',
    },
  },
  android: {
    ...config.android,
    config: {
      googleMaps: {
        // Embeds the key into AndroidManifest.xml at prebuild time.
        apiKey: androidKey ?? '',
      },
    },
  },
});
