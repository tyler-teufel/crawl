# File Reference

Every file in the Crawl project with detailed descriptions of its purpose and behavior.

---

## Configuration Files

| File                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`        | Project dependencies and npm scripts. Entry point is `expo-router/entry`. Key scripts: `start` (dev server), `lint` (ESLint + Prettier check), `format` (auto-fix), `prebuild` (native build prep).                                                                                                                                                                                                              |
| `app.json`            | Expo app configuration. Dark mode UI (`userInterfaceStyle: "dark"`), dark splash background (#0a0a0f), portrait orientation. Plugins: `expo-router`, `expo-apple-authentication`, `expo-location` (with usage description strings), `@react-native-google-signin/google-signin` (with `iosUrlScheme` placeholder). iOS tablet support enabled with `usesAppleSignIn: true`; Android adaptive icon configured.                                                                                                                                                                                                   |
| `tsconfig.json`       | TypeScript configuration. Extends `expo/tsconfig.base`. Strict mode enabled. Path alias `@/*` → `src/*`.                                                                                                                                                                                                                                                                                                         |
| `babel.config.js`     | Babel preset configuration. Uses `babel-preset-expo` with `jsxImportSource: 'nativewind'` (enables `className` on JSX), `nativewind/babel` for CSS processing, and `react-native-worklets/plugin` for worklet thread support.                                                                                                                                                                                    |
| `metro.config.js`     | Metro bundler configuration. Wraps the default Expo config with `withNativeWind()` which processes `global.css` and sets `inlineRem: 16` (converts rem units to 16px base for React Native).                                                                                                                                                                                                                     |
| `tailwind.config.js`  | Tailwind CSS configuration with NativeWind preset. Defines two color systems: the `crawl-*` custom palette (hardcoded hex) and semantic tokens mapped from CSS variables (`bg-primary`, etc.). Includes `borderWidth: hairline` utility, accordion keyframes/animations, and `tailwindcss-animate` plugin. Content array scans `app/`, `components/`, `src/`, and `@rnr` node_modules. Dark mode set to `class`. |
| `global.css`          | Tailwind directives and CSS variable definitions. Defines light and dark theme tokens using `@layer base` with `:root` and `.dark:root` selectors. Dark mode values are themed to match the Crawl palette (purple primary, dark navy backgrounds).                                                                                                                                                               |
| `eslint.config.js`    | ESLint flat config extending `eslint-config-expo`. Ignores `dist/*`. Disables `react/display-name` rule.                                                                                                                                                                                                                                                                                                         |
| `prettier.config.js`  | Prettier formatting rules. 100 character line width, 2-space tabs, single quotes, bracket same line, trailing commas (ES5). Integrates `prettier-plugin-tailwindcss` for automatic class sorting on `className` attributes.                                                                                                                                                                                      |
| `nativewind-env.d.ts` | TypeScript type reference for NativeWind. Enables type checking on `className` props for React Native components.                                                                                                                                                                                                                                                                                                |
| `components.json`     | React Native Reusables CLI configuration. Specifies component style (`new-york`), output paths, and Tailwind settings. The CLI reads this to scaffold components into the correct directories.                                                                                                                                                                                                                   |

---

## Screen Files (`app/`)

### `app/_layout.tsx` — Root Layout

The top-level layout wrapping the entire application. Responsibilities:

- **Imports `global.css`** — triggers NativeWind CSS processing
- **`ThemeProvider`** — from `@react-navigation/native`, provides the `NAV_THEME` matching the current color scheme to React Navigation internals
- **`useColorScheme`** — from NativeWind, detects system color scheme. An `useEffect` forces dark mode on mount
- **`AuthProvider`** — bootstraps the Supabase session (anonymous if none persisted) and exposes auth + location state to the rest of the app. Sits **above** `VenueProvider` so future user-scoped queries can read the user.
- **`VenueProvider`** — React Context wrapping all routes so filter state, search, and votes are shared between tabs, modals, and stack screens
- **`Stack` navigator** — four route entries: `(onboarding)` (first-launch group), `(tabs)` (default), `venue/[id]` (push navigation), and `filters` (transparent modal with fade animation)
- **`OnboardingGate`** — sibling of `Stack` that reads `crawl.firstLaunchComplete.v1` from AsyncStorage; until the flag is set, emits `<Redirect href="/(onboarding)" />` so first-launch users land on the welcome splash
- **`StatusBar`** — set to `"light"` for white status bar text against the dark background
- **`PortalHost`** — from `@rn-primitives/portal`, rendered last to support overlay rendering for RNR components (dialogs, selects, etc.)

### `app/(onboarding)/_layout.tsx` — Onboarding Stack

Stack navigator for the first-launch flow. `headerShown: false`, dark backdrop. Registers the three onboarding screens (`index`, `location`, `auth`).

### `app/(onboarding)/index.tsx` — Welcome Splash

Centered brand splash: Crawl logo glyph, name, one-line value prop, and a "Get Started" CTA that pushes `/location`. Safe-area-aware top/bottom padding.

### `app/(onboarding)/location.tsx` — Location Permission

Prompts for foreground location. The "Enable Location" CTA dynamically requires `expo-location` (lazy import for Expo Go safety), calls `requestForegroundPermissionsAsync()`, and on grant calls `getCurrentPositionAsync({ accuracy: Balanced })`. The resulting `{ latitude, longitude }` is stashed in `AuthContext.userLocation` for Phase B Agent 2 to consume when seeding the initial city. A "Not now" link skips without prompting; both paths route to `/auth`.

### `app/(onboarding)/auth.tsx` — Auth Choice

Three vertically-stacked buttons:

- **Continue with Apple** — iOS only (hidden on Android via `Platform.OS` check), required by App Store rule 4.8. Calls `linkApple()`.
- **Continue with Google** — both platforms. Calls `linkGoogle()`.
- **Continue anonymously** — calls `ensureSignedIn()`, which is a no-op if an anonymous session already exists.

All three paths call `markOnboardingComplete()` and `router.replace('/(tabs)')`. Errors surface via `Alert.alert` with the helper's message — Apple/Google native module absence (Expo Go) flows through this path.

### `app/(tabs)/_layout.tsx` — Tab Layout

Configures the bottom tab navigator using expo-router's `Tabs` component. Replaces the default tab bar with `components/layout/TabBar.tsx`. Registers four tab screens: `index`, `voting`, `global`, `profile`.

### `app/(tabs)/index.tsx` — Explore Screen

The main map exploration screen. Layout from top to bottom:

1. **SearchBar** — text input with filter icon button. Filter button pushes `/filters` modal.
2. **Filter chips** — horizontal `ScrollView` of `FilterChip` components. Tapping toggles the filter in context.
3. **MapPlaceholder** — full-flex dark grid with animated venue pins. Tapping a pin navigates to `/venue/{id}`.
4. **Venue carousel** — horizontal `FlatList` of `VenueCard` components with `snapToInterval` for card paging. Card width is 80% of screen width.

Uses `useVenueContext()` for `filteredVenues`, `filters`, `toggleFilter`, `searchQuery`, and `setSearchQuery`.

### `app/(tabs)/voting.tsx` — Voting Screen

Daily voting interface. Scrollable layout:

1. **Header** — "Daily Hotspot Votes" title and subtitle
2. **CitySelector** — shows "Austin, TX" with dropdown chevron (dropdown not implemented)
3. **VoteCounter** — large display of remaining/max votes (e.g., "3 / 3")
4. **CountdownTimer** — live HH:MM:SS countdown to midnight when votes reset
5. **Venue list** — venues sorted by hotspot score, rendered as `VenueListItem` rows. Each has a heart button to cast or remove a vote.

Uses `useVenueContext()` for `venues`, `voteState`, `castVote`, `removeVote`, and `selectedCity`.

### `app/(tabs)/global.tsx` — Global Rankings (Placeholder)

Centered placeholder with globe icon, "Global Rankings" title, and "Coming Soon" subtitle. Safe area padding applied.

### `app/(tabs)/profile.tsx` — Profile (Placeholder)

Centered placeholder with person icon, "Your Profile" title, and "Coming Soon" subtitle. Safe area padding applied.

### `app/venue/[id].tsx` — Venue Detail

Full venue detail screen accessed by tapping a venue card or list item. Reads the `id` URL parameter to find the venue in mock data.

Layout:

1. **Header** — back button (navigates back) and share button
2. **Image placeholder** — dark card area with image icon
3. **Name + badges** — venue name with TRENDING badge if applicable
4. **Status row** — OPEN/CLOSED badge, hours, price level (dollar signs)
5. **HotspotScore** — animated SVG circular progress ring showing the score (0-100)
6. **Vote button** — purple CTA "Vote as Tonight's Hotspot"
7. **About** — venue description text
8. **Highlights** — chips with sparkle icons for each highlight tag
9. **Location** — card with address and navigate icon

### `app/filters.tsx` — Filters Modal

Transparent modal overlay. Semi-transparent black backdrop — tapping it dismisses the modal. Bottom sheet slides up containing:

1. **Handle** — drag indicator bar
2. **Header** — "Filters" title, Reset text button, close icon button
3. **Filter list** — each filter as a row with icon, label, and `Switch` toggle
4. **Apply button** — purple CTA that dismisses the modal

Filter changes are immediate — toggling a switch updates the context, which updates the Explore screen's `filteredVenues` in real time.

---

## Component Files

### `components/layout/TabBar.tsx`

Custom bottom tab bar replacing React Navigation's default. Renders four tabs with Ionicons:

| Tab     | Icon (Active)      | Icon (Inactive)   |
| ------- | ------------------ | ----------------- |
| Explore | `compass` (filled) | `compass-outline` |
| Voting  | `heart` (filled)   | `heart-outline`   |
| Global  | `globe` (filled)   | `globe-outline`   |
| Profile | `person` (filled)  | `person-outline`  |

Active tabs get a purple highlight background (`bg-crawl-purple/20`), filled icon colored purple-light, and semibold purple-light text. Inactive tabs get outline icons and muted text. Safe area bottom inset is applied for notched devices.

### `components/map/MapPlaceholder.tsx`

Dark-themed view simulating a map. Renders a grid pattern (8 horizontal + 6 vertical semi-transparent lines) on a `crawl-surface` background. Places `MapPin` components at predetermined percentage positions (8 fixed positions cycling). Includes `MapControls` overlay in the bottom-right.

**Designed as a drop-in replacement target.** The component's interface (`venues: Venue[], onPinPress: (venue) => void`) matches what a real `react-native-maps` wrapper would accept.

### `components/map/MapPin.tsx`

Venue pin component. Circular button with a beer icon. Two visual states:

- **Non-trending:** Static dark purple (#5b0daa) circle
- **Trending:** Purple (#7f13ec) circle with an animated glow ring. The glow is an `Animated.View` behind the pin that scales from 1x to 1.8x and fades from 60% to 0% opacity on a 1500ms infinite loop using `react-native-reanimated`'s `withRepeat` and `withTiming`.

### `components/map/MapControls.tsx`

Three stacked circular buttons (zoom in, zoom out, locate) positioned absolute bottom-right of the map area. Currently decorative — no interaction wired up. Ready to connect to a real map's `animateToRegion` and `getCurrentPosition` APIs.

### `components/ui/SearchBar.tsx`

Row layout with two elements:

- **Search input** — rounded card-background container with search icon, text input, and placeholder text
- **Filter button** — purple circular button with options icon, triggers `onFilterPress` callback

### `components/ui/FilterChip.tsx`

Pressable pill-shaped chip with optional leading Ionicon and text label. Two visual states:

- **Active:** Purple background, white text/icon
- **Inactive:** Card background, muted text/icon

Used in the Explore screen's horizontal filter strip.

### `components/ui/Badge.tsx`

Small rounded pill badge for status indicators. Three variants:

| Variant    | Background | Use Case                 |
| ---------- | ---------- | ------------------------ |
| `trending` | Purple     | "TRENDING", "HOT" labels |
| `open`     | Green      | "OPEN" status            |
| `closed`   | Red        | "CLOSED" status          |

All variants render uppercase bold white text.

### `components/venue/VenueCard.tsx`

Card component for the bottom carousel on the Explore screen. Parameterized width for snap interval calculations. Displays:

- Venue name, type, distance
- Trending/Open badges (top right)
- Hotspot score in a purple circle with vote count
- Price level as green/muted dollar signs
- Up to 3 highlight tags as small pills
- Purple "View Details" CTA button

### `components/venue/HotspotScore.tsx`

Animated SVG circular progress ring. Uses `react-native-svg` for the circle elements and `react-native-reanimated` for the animation.

- **Background circle:** Dark card-colored stroke
- **Progress circle:** Purple stroke with animated `strokeDashoffset`
- **Center text:** Score number (large, bold) and "Hotspot Score" label

The progress animates from 0 to the target score on mount with cubic easing over 1200ms. Size is configurable (default 140px, 8px stroke width).

### `components/venue/VenueListItem.tsx`

Row component for the voting screen's ranked list. Layout left to right:

1. **Rank** — number in a circle (surface background)
2. **Info** — venue name (with HOT badge if trending), type, and vote count
3. **Score** — hotspot score number in purple-light
4. **Vote button** — heart icon button. Filled purple when voted, outline when not. Disabled (40% opacity) when no votes remain and the venue hasn't been voted for. `stopPropagation` on the heart press prevents triggering the row's navigation.

### `components/voting/VoteCounter.tsx`

Large centered vote display. Shows remaining votes in large purple-light text, max votes in smaller muted text (e.g., "3 / 3"). Below: heart icon and "Votes Remaining Today" label.

### `components/voting/CountdownTimer.tsx`

Live countdown to midnight. Three `TimeBlock` sub-components (hours, minutes, seconds) — each rendered in a rounded card-background box showing the value and a label (HRS/MIN/SEC). Purple colon separators between blocks. Powered by `useCountdown` hook, updates every second.

### `components/voting/CitySelector.tsx`

Pressable button showing a location pin icon, city name text, and a dropdown chevron icon. Styled as a rounded pill on card background. The `onPress` callback is provided but not yet connected to a dropdown/picker.

---

## Shared Logic (`src/`)

### `src/types/venue.ts`

TypeScript interfaces:

- **`Venue`** — 16 fields: `id`, `name`, `type`, `address`, `distance`, `hotspotScore`, `voteCount`, `isOpen`, `isTrending`, `highlights` (string[]), `latitude`, `longitude`, `imageUrl?`, `priceLevel` (1-4), `hours`, `description`
- **`FilterOption`** — `id`, `label`, `icon?`, `enabled`
- **`VoteState`** — `remainingVotes`, `maxVotes`, `votedVenueIds` (string[])

### `src/data/venues.ts`

Array of 8 mock venues in Austin, TX:

| Venue             | Type         | Score | Trending | Open |
| ----------------- | ------------ | ----- | -------- | ---- |
| Whiskey Tango     | Cocktail Bar | 92    | Yes      | Yes  |
| The Rustic Tap    | Dive Bar     | 87    | Yes      | Yes  |
| Neon Lounge       | Nightclub    | 78    | No       | Yes  |
| Brewski Garden    | Beer Garden  | 85    | No       | Yes  |
| Midnight Cowboy   | Speakeasy    | 94    | Yes      | No   |
| Lavaca Street Bar | Sports Bar   | 71    | No       | Yes  |
| Hotel Vegas       | Live Music   | 88    | Yes      | Yes  |
| Roosevelt Room    | Cocktail Bar | 90    | No       | Yes  |

### `src/data/filters.ts`

Array of 10 default filter options (all disabled initially): Trending, Open Now, Live Music, Happy Hour, Rooftop, Craft Cocktails, Dive Bar, Sports Bar, Dancing, Outdoor Patio. Each has an Ionicon name for its icon.

### `src/constants/colors.ts`

Color palette as a `const` object for use in inline `style` props (where Tailwind classes can't be used):

```typescript
export const colors = {
  purple: '#7f13ec',
  purpleLight: '#a855f7',
  purpleDark: '#5b0daa',
  bg: '#0a0a0f',
  card: '#1a1a2e',
  surface: '#16162a',
  green: '#22c55e',
  textMuted: '#9ca3af',
  white: '#ffffff',
  red: '#ef4444',
} as const;
```

### `src/context/VenueContext.tsx`

React Context provider and `useVenueContext()` hook. Manages filter state, search query, city selection, and vote state. Derives `filteredVenues` by applying search and active filter logic. Uses `useCallback` for memoized action functions. The hardcoded `selectedCity` default ("Austin, TX") is marked with a `TODO(phase-b-agent-2)` to swap to `userLocation`-derived city resolution. See the [Architecture](./ARCHITECTURE.md#3-state-management) doc for the full state tree.

### `src/context/AuthContext.tsx`

Auth state + identity context. Bootstraps the Supabase session on mount via `ensureSignedIn()` (creates an anonymous user if none persisted). Subscribes to `supabase.auth.onAuthStateChange` so `user` and `isAnonymous` track the current identity — including the in-place upgrade that occurs when an anonymous user signs in with Apple or Google. Exposes:

- `user`, `isAnonymous`, `initializing`
- `userLocation`, `setUserLocation` — used by `app/(onboarding)/location.tsx` to stash the foreground-permission coords; available to consumers (e.g. Phase B Agent 2's city resolver)
- `linkApple()`, `linkGoogle()`, `signOut()` — bound versions of the helpers in `src/lib/auth.ts`

### `src/hooks/useCountdown.ts`

Custom hook returning `{ hours, minutes, seconds }` as zero-padded two-character strings. Calculates seconds remaining until midnight using `Date` objects. Sets a 1-second `setInterval` on mount, clears on unmount.

### `src/lib/utils.ts`

Exports the `cn()` function — combines `clsx` (conditional class logic) with `tailwind-merge` (class conflict resolution). Used by RNR components and available for custom components. See the [RNR guide](./REACT_NATIVE_REUSABLES.md#5-using-the-cn-utility) for usage examples.

### `src/lib/theme.ts`

Exports `THEME` (light/dark color objects with HSL strings matching `global.css`) and `NAV_THEME` (React Navigation theme objects extending `DefaultTheme` and `DarkTheme`). The dark theme values are mapped to Crawl's color palette. Used by `ThemeProvider` in the root layout.

### `src/lib/auth.ts`

Auth helpers used by `AuthContext` and the onboarding auth screen:

- `ensureSignedIn()` — returns the existing Supabase user, or signs in anonymously if no session is persisted.
- `signInWithApple()` — iOS-only; lazily requires `expo-apple-authentication`, requests `FULL_NAME` + `EMAIL` scopes, then exchanges the `identityToken` via `supabase.auth.signInWithIdToken({ provider: 'apple' })`. When called with an active anonymous session, supabase-js upgrades the existing user in place rather than creating a new one.
- `signInWithGoogle()` — same pattern using `@react-native-google-signin/google-signin`. Reads `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and optional `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`) and configures `GoogleSignin` once on first call.
- `signOut()` — passthrough to `supabase.auth.signOut()`.

Native module imports are wrapped in `try/catch` so the JS bundle still boots in Expo Go (where the native modules are absent); the helpers throw a descriptive error when invoked there instead.

### `src/lib/onboarding.ts`

Two helpers around the AsyncStorage flag `crawl.firstLaunchComplete.v1`:

- `isOnboardingComplete()` — read flag.
- `markOnboardingComplete()` — write flag (called from `app/(onboarding)/auth.tsx` once the user picks any auth path).

### `src/lib/supabase.ts`

Supabase client singleton. Configured with `auth.storage = AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. Reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`; throws at import time if either is missing.

---

## Development Tools

### `.claude/commands/docs.md`

Claude Code skill definition for the `/docs` command. Provides a structured 6-step process for updating documentation: (1) assess changes via `git diff`/`git log`, (2) map changed files to affected docs using a lookup table, (3) read affected docs and source files, (4) apply targeted updates per doc type, (5) include/update ASCII diagrams, (6) verify internal links and index accuracy.

### `.github/workflows/ci.yml`

PR + push-to-main validation. Single `validate` job runs `turbo run lint typecheck test` with `--filter=...[origin/<base>]` on PRs (Turbo affected detection) and unfiltered on `main`. Caches `node_modules` and `.turbo`. Uploads `apps/api/coverage/` if produced. Parallel `fingerprint` job emits the Expo native-deps hash for OTA eligibility. See [CI/CD Pipeline](../ops/CICD_PIPELINE.md).

### `.github/workflows/security.yml`

Security gates run on PRs, pushes to `main`, and a weekly Monday 08:00 UTC schedule. Three jobs: **CodeQL** (`javascript-typescript`, `security-and-quality` queries), **gitleaks** (full-history secret scan), and **npm audit** (`--audit-level=high`; warn on PRs, fail on schedule).

### `.github/workflows/release-mobile.yml`

`workflow_dispatch`-only mobile release. Inputs: `release_type` (`ota` | `binary`), `bump`, `channel` (`staging` | `production`), `submit` (binary+production opt-in). Validates → computes version → either pushes an `eas update` OTA or runs `eas build` (and optionally `eas submit`) → tags and pushes back. Tag formats: `mobile-vX.Y.Z` for binary, `mobile-vX.Y.Z-ota.<UTC-ts>` for OTA.

### `.github/workflows/release-api.yml`

`workflow_dispatch`-only API release. Inputs: `bump`, `environment` (`staging` | `production`), `run_migrations`. Pipeline: `validate` → `release` (bump `apps/api/package.json`, commit, tag) → `deploy` (Railway CLI, gated by GitHub Environment) → optional `migrate` (`drizzle-kit migrate`). Production tag: `api-vX.Y.Z`; staging tag: `api-vX.Y.Z-staging`.

### `.github/workflows/release-version.yml`

Standard `changesets/action@v1` flow. On every push to `main`, opens or updates a single "chore(release): version packages" PR aggregating pending `.changeset/*.md` files. Merging that PR bumps versions in each affected package and writes the per-package `CHANGELOG.md`. No publish — all packages are private.

### `.changeset/config.json` + `.changeset/README.md`

Changesets configuration (independent semver per service, no fixed/linked groups, all packages private) and the contributor walkthrough for `npm run changeset`.
