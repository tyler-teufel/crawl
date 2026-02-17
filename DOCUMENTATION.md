# Crawl – Technical Documentation

## Overview

**Crawl** is a React Native (Expo) nightlife discovery app that surfaces local bars and nightclubs on an interactive Google Maps-powered map. Users can anonymously cast up to **two "hotspot" votes per calendar day** to signal where the crowd is heading that evening. Each venue displays a live popularity score derived from the evening's votes.

---

## Table of Contents

1. [Project Setup & Running](#1-project-setup--running)
2. [Directory Structure](#2-directory-structure)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Screens & UI](#4-screens--ui)
5. [Components](#5-components)
6. [Hooks](#6-hooks)
7. [Types](#7-types)
8. [Mock Data & API Readiness](#8-mock-data--api-readiness)
9. [Google Maps Configuration](#9-google-maps-configuration)
10. [Voting System](#10-voting-system)
11. [TypeScript Notes](#11-typescript-notes)
12. [Connecting a Real API](#12-connecting-a-real-api)

---

## 1. Project Setup & Running

### Prerequisites
- Node.js 18+
- npm 9+
- Expo CLI (`npm install -g expo`)
- For iOS: Xcode 15+, CocoaPods
- For Android: Android Studio, Java 17

### Install dependencies
```bash
npm install
```

### Development (Expo Go)
```bash
npx expo start          # starts Metro bundler
npx expo start --ios    # opens iOS simulator
npx expo start --android  # opens Android emulator
```

> **Note:** In Expo Go, Google Maps on iOS falls back to Apple Maps because the Google Maps iOS SDK requires native code. Google Maps works in Expo Go on Android via the API key in `app.json`.

### Production build (with full Google Maps on both platforms)
```bash
npx expo prebuild       # generates /ios and /android native projects
npx expo run:ios        # builds and runs on iOS (requires Xcode)
npx expo run:android    # builds and runs on Android (requires Android Studio)
```

---

## 2. Directory Structure

```
crawl/
├── app/
│   ├── _layout.tsx          # Expo Router root layout (stack navigator)
│   └── index.tsx            # Main MapScreen – the entire app
│
├── components/
│   ├── BarCard.tsx          # Compact horizontal-scroll card
│   ├── BarDetailSheet.tsx   # Full-detail modal bottom sheet
│   ├── BarMarker.tsx        # Custom map marker with popularity score
│   └── FilterBar.tsx        # Horizontal filter chip strip
│
├── data/
│   └── mockBars.ts          # 12 fictional NYC bars (API placeholder)
│
├── hooks/
│   ├── useBars.ts           # Derives scored bars from raw data + vote state
│   └── useVoting.ts         # Manages daily vote quota with AsyncStorage
│
├── types/
│   └── index.ts             # All shared TypeScript interfaces & constants
│
├── app.json                 # Expo config (API keys, plugins, permissions)
├── tsconfig.json            # TypeScript config (NativeWind JSX transform)
├── babel.config.js          # Babel config (NativeWind preset)
├── tailwind.config.js       # TailwindCSS config for NativeWind
└── DOCUMENTATION.md         # This file
```

---

## 3. Architecture & Data Flow

```
AsyncStorage
    │
    ▼
useVoting()          ──► voteState { votesRemaining, votedBarIds, lastResetDate }
    │
    │  (voteState)
    ▼
useBars(voteState, filter)
    │   mockBars (→ API in future)
    │   + computes voteCount, popularityScore, isOpen, userVoted
    │   + filters by type
    │   + sorts by popularityScore DESC
    ▼
MapScreen (app/index.tsx)
    │
    ├── <MapView>  ─── markers rendered for each BarWithScore
    │       └── <BarMarker>  (heat colour based on score)
    │
    ├── <FilterBar>  ──  sets `filter` state → triggers useBars recalculation
    │
    ├── <ScrollView horizontal>
    │       └── <BarCard> × N  (inline vote button, popularity bar)
    │
    └── <BarDetailSheet>  (Modal, slide-up)
            └── vote CTA → calls vote(barId) → updates voteState
                → useBars recomputes → all UI updates reactively
```

State lives entirely in `MapScreen`. There is no global state manager; the two hooks expose everything needed.

---

## 4. Screens & UI

### MapScreen (`app/index.tsx`)

The single screen of the app. It is composed in four absolute-positioned layers:

| Layer | Component | Description |
|-------|-----------|-------------|
| 1 (bottom) | `MapView` | Full-bleed dark-styled Google/Apple map with bar markers |
| 2 | Header overlay | App name, daily vote counter, type filter chips |
| 3 | Bottom panel | Horizontally snapping bar card carousel |
| 4 (top) | `BarDetailSheet` | Modal slide-up with full bar info and vote CTA |

**Interactions:**
- **Tap a marker** → map animates to bar, carousel scrolls to matching card, marker highlights
- **Tap a card** → same as tap marker, plus the detail sheet opens
- **Tap "🔥 Vote" in card** → casts vote inline without leaving map view
- **Tap "🔥 Vote as Tonight's Hotspot" in detail sheet** → casts vote from full detail view
- **Tap a filter chip** → map and carousel filter to that venue type
- **Tap map backdrop on detail sheet** → dismisses the sheet

**Splash screen:** While `useVoting` loads from AsyncStorage (usually < 50 ms), a branded loading indicator is shown.

---

## 5. Components

### `BarMarker`

Custom `react-native-maps` marker rendered inside `<Marker>`.

| Prop | Type | Description |
|------|------|-------------|
| `bar` | `BarWithScore` | The bar to display |
| `isSelected` | `boolean` | Enlarges marker with white border |
| `onPress` | `() => void` | Forwarded tap handler |

**Heat colours:**

| Score | Colour | Label |
|-------|--------|-------|
| 80–100 | `#EF4444` (red) | Super hot |
| 60–79 | `#F59E0B` (amber) | Hot |
| 40–59 | `#8B5CF6` (purple) | Moderate |
| 0–39 | `#6B7280` (grey) | Cool |

---

### `BarCard`

Compact card in the horizontal bottom carousel.

| Prop | Type | Description |
|------|------|-------------|
| `bar` | `BarWithScore` | The bar to display |
| `isSelected` | `boolean` | Highlights card with amber border |
| `onPress` | `() => void` | Opens full detail sheet |
| `votesRemaining` | `number` | Used to disable the vote button |
| `onVote` | `() => void` | Casts an inline vote |

**Exports:**
```typescript
export const CARD_WIDTH: number;     // 78% of screen width
export const CARD_MARGIN: number;    // 8px on each side
export const SNAP_INTERVAL: number;  // CARD_WIDTH + CARD_MARGIN * 2
```
These are imported by `MapScreen` to keep carousel snap maths consistent.

---

### `BarDetailSheet`

Full-detail bottom sheet rendered as a transparent `Modal` with `animationType="slide"`.

| Prop | Type | Description |
|------|------|-------------|
| `bar` | `BarWithScore \| null` | Bar to display; nothing renders if null |
| `visible` | `boolean` | Controls modal visibility |
| `onClose` | `() => void` | Called when backdrop or system back is pressed |
| `onVote` | `(barId: string) => void` | Casts a vote for the bar |
| `voteState` | `VoteState` | Current vote state for button label and disabling |

**Sections rendered:**
1. Drag handle
2. Bar name + type badge + open/closed pill
3. Address and hours
4. Tonight's Hotness – percentage bar with live score
5. Details grid – cover charge, price range, capacity
6. Tag chips
7. Description text
8. Phone number (tappable `tel:` link)
9. Vote CTA button + votes-remaining label

---

### `FilterBar`

Horizontally scrollable chip strip at the top of the screen.

| Prop | Type | Description |
|------|------|-------------|
| `filter` | `FilterType` | Currently active filter |
| `onFilterChange` | `(f: FilterType) => void` | Called when a chip is pressed |

Available filters: All, Bars (`bar`), Clubs (`nightclub`), Lounges (`lounge`), Sports (`sports_bar`).

---

## 6. Hooks

### `useVoting()`

```typescript
const { voteState, vote, isLoading } = useVoting();
```

Manages the user's daily vote quota.

**Returns:**

| Key | Type | Description |
|-----|------|-------------|
| `voteState` | `VoteState` | Current persisted vote state |
| `vote(barId)` | `(id: string) => Promise<boolean>` | Cast a vote; returns `true` on success |
| `isLoading` | `boolean` | True while reading from AsyncStorage |

**Business rules:**
- `MAX_DAILY_VOTES = 2` – defined in `types/index.ts`
- State resets at midnight (calendar-date comparison)
- A user cannot vote for the same bar twice in one day
- All state is persisted to AsyncStorage under key `@crawl_vote_state_v1`

**TODO markers for API integration:**
```typescript
// TODO: Call POST /api/votes here once the backend is ready.
//       On success, update local state. On failure, revert.
```

---

### `useBars(voteState, filter)`

```typescript
const bars = useBars(voteState, filter);
// returns BarWithScore[], sorted by popularityScore DESC
```

Pure computation hook (no side effects). Wrapped in `useMemo` – re-runs only when `voteState` or `filter` changes.

**Popularity score formula:**
```
voteCount = bar.baseVoteCount + (userVoted ? 1 : 0)
popularityScore = Math.round((voteCount / MAX_VOTE_COUNT) * 100)
```
`MAX_VOTE_COUNT` is the highest `baseVoteCount` across all bars (currently 421 for "The Grid"). This normalises scores to 0–100.

**Open/closed detection:**
Parses `hours.open` and `hours.close` strings (e.g. `"9:00 PM"`, `"4:00 AM"`) using `parseHourMinute()`. Handles bars that close after midnight by comparing minute-of-day values with wrap-around logic.

---

## 7. Types

All types are in `types/index.ts`.

### `Bar`
Raw bar record as it would come from the API. The `baseVoteCount` field seeds the popularity score; in production this would be replaced by the server's real-time vote tally.

### `BarWithScore extends Bar`
Computed shape returned by `useBars`. Never stored; always derived.

| Added field | Type | Description |
|-------------|------|-------------|
| `voteCount` | `number` | `baseVoteCount` + user's vote if applicable |
| `popularityScore` | `number` | 0–100 normalised score |
| `isOpen` | `boolean` | Whether the bar is open right now |
| `userVoted` | `boolean` | Whether the current user already voted here today |

### `VoteState`
Shape stored in AsyncStorage.

```typescript
interface VoteState {
  votesRemaining: number;  // counts down from MAX_DAILY_VOTES
  lastResetDate: string;   // "YYYY-MM-DD" for day-boundary detection
  votedBarIds: string[];   // prevents duplicate votes per bar per day
}
```

### `BarType` / `FilterType`
```typescript
type BarType    = 'bar' | 'nightclub' | 'lounge' | 'sports_bar';
type FilterType = 'all' | BarType;
```

---

## 8. Mock Data & API Readiness

`data/mockBars.ts` exports 12 fictional bars spread across Midtown Manhattan. Each bar's shape exactly matches the `Bar` interface, so swapping it for a real API response requires no changes in consuming components.

**To connect a real API:**
1. Replace the `mockBars` import in `hooks/useBars.ts` with a fetch/query call.
2. Remove `baseVoteCount` from the `Bar` interface and receive live `voteCount` directly from the server.
3. Remove the local `MAX_VOTE_COUNT` normalisation; use the server-provided `popularityScore`.

---

## 9. Google Maps Configuration

API keys are managed via environment variables – they are **never stored in source control**.

### Secrets files

| File | Committed? | Purpose |
|------|-----------|---------|
| `.env.example` | ✅ yes | Documents which variables are required; contains no real values |
| `.env` | ❌ no (gitignored) | Local developer secrets |

### Local development setup
```bash
cp .env.example .env
# Then open .env and fill in your real API keys
```

`.env` contents:
```
GOOGLE_MAPS_API_KEY_IOS=your_ios_key_here
GOOGLE_MAPS_API_KEY_ANDROID=your_android_key_here
```

Expo CLI automatically loads `.env` before evaluating `app.config.js`. The keys are embedded into the native project at prebuild time – they are **not** bundled into the JavaScript layer.

### How it works (`app.config.js`)

`app.config.js` receives the static `app.json` as its `config` argument and merges the API keys from `process.env`:

```javascript
module.exports = ({ config }) => ({
  ...config,
  ios:     { ...config.ios,     config: { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS } },
  android: { ...config.android, config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID } } },
});
```

If a key is missing, a warning is printed to the console at build time (the app will still bundle, but Maps won't load).

### Obtaining API keys
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Maps SDK for Android** and/or **Maps SDK for iOS**
4. Create an API key under **APIs & Services → Credentials**
5. Restrict the key to the appropriate platform (SHA-1 fingerprint for Android; bundle ID for iOS)

### CI / EAS Build (production)

Set the variables as EAS Secrets so they are injected at build time without being stored in the repository:

```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS     --value "your_ios_key"
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "your_android_key"
```

Or reference them in an `eas.json` build profile:

```json
{
  "build": {
    "production": {
      "env": {
        "GOOGLE_MAPS_API_KEY_IOS":     "your_ios_key",
        "GOOGLE_MAPS_API_KEY_ANDROID": "your_android_key"
      }
    }
  }
}
```

> **Note:** `eas.json` should also be gitignored if it contains real key values. Prefer EAS Secrets for production.

### iOS in Expo Go
In Expo Go on iOS the app falls back to Apple Maps (no API key required). All other functionality – cards, voting, filters, detail sheet – works identically. Full Google Maps on iOS requires `npx expo prebuild && npx expo run:ios` with a valid `GOOGLE_MAPS_API_KEY_IOS`.

### Map Style
The dark map style (`DARK_MAP_STYLE` array in [app/index.tsx](app/index.tsx)) is applied via `customMapStyle` on `MapView`. It suppresses default POI markers to keep only Crawl's custom bar markers visible. Custom map styles only render with `PROVIDER_GOOGLE`; on Apple Maps the style is ignored.

---

## 10. Voting System

### Rules
| Rule | Implementation |
|------|---------------|
| 2 votes per user per calendar day | `MAX_DAILY_VOTES = 2` constant; decrements on each vote |
| Cannot vote for same bar twice | `votedBarIds` array checked before accepting vote |
| Votes reset at midnight | `lastResetDate` (YYYY-MM-DD) compared to today's date on app load |
| Anonymous | No user account; state stored only on device |

### Vote flow
```
User presses "🔥 Vote"
    │
    ▼
handleVote(barId) in MapScreen
    │
    ▼
vote(barId) in useVoting
    ├── guard: votesRemaining > 0
    ├── guard: barId not in votedBarIds
    ├── optimistically update state
    └── persist to AsyncStorage
            │
            ▼
        useBars recomputes (voteState changed)
            │
            ▼
        bar.voteCount += 1, popularityScore updated
            │
            ▼
        Marker colour, card bar, detail sheet all re-render
```

### Vote UI states
| State | Card button | Detail button |
|-------|-------------|---------------|
| Can vote | `🔥 Vote` (amber) | `🔥 Vote as Tonight's Hotspot` (amber, glowing) |
| Already voted for this bar | `✓ Voted` (grey) | `✓ Voted as Tonight's Hotspot` (grey) |
| Daily quota exhausted | `Used up` (grey) | `No Votes Remaining Today` (grey) |

---

## 11. TypeScript Notes

### NativeWind JSX transform
`tsconfig.json` sets `"jsx": "react-jsx"` and `"jsxImportSource": "nativewind"` to match the Babel config's `jsxImportSource: 'nativewind'` option. This allows the TypeScript language server to correctly type-check NativeWind's `className` prop and avoids false-positive `--jsx` errors in some IDEs.

### React 19 ref compatibility
React 19 treats `ref` as a regular prop, but many library types (including `react-native-maps` and older RN core types) were written for React 18 where `ref` was handled outside of component props. `app/index.tsx` defines a `WithRef<C, Instance>` utility type and casts `MapView` and `ScrollView` to it so refs can be passed without `as any`:

```typescript
type WithRef<C extends React.ComponentType<object>, Instance> = React.ComponentType<
  React.ComponentProps<C> & { ref?: React.Ref<Instance> }
>;
const MapViewRef  = MapView  as WithRef<typeof MapView,  MapView>;
const ScrollViewRef = ScrollView as WithRef<typeof ScrollView, ScrollView>;
```

This changes only TypeScript types, not runtime behaviour.

---

## 12. Connecting a Real API

The following `TODO` comments in the codebase mark the exact integration points:

| File | Location | What to do |
|------|----------|------------|
| `hooks/useVoting.ts` | `vote()` function | Call `POST /api/votes` and revert on failure |
| `hooks/useBars.ts` | `useMemo` body | Replace `mockBars` with `GET /api/bars` (+ geolocation bounds) |
| `app/index.tsx` | Location `useEffect` | Animate map to user's real location once bars use real coords |

**Suggested API contract:**

```
GET  /api/bars?lat={lat}&lng={lng}&radius={km}
→ Bar[]  (with live voteCount and popularityScore from the server)

POST /api/votes
Body: { barId: string, sessionToken: string }
→ { success: boolean, newVoteCount: number }
```

A session token (anonymous UUID stored in SecureStore) would replace the current device-only AsyncStorage approach, enabling cross-device deduplication without requiring user accounts.
