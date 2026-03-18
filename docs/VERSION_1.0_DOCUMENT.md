# Crawl App — Version 1.0 Document

**Version:** 1.0.0-alpha
**Date:** March 16, 2026
**Status:** Frontend shell complete — mock data, no backend integration

---

## Table of Contents

1. [What Was Built](#1-what-was-built)
2. [Architecture Overview](#2-architecture-overview)
3. [File Reference](#3-file-reference)
4. [Design Decisions & Rationale](#4-design-decisions--rationale)
5. [Architecture Diagrams](#5-architecture-diagrams)
6. [Maps SDK Integration Guide](#6-maps-sdk-integration-guide)
7. [Data Pipeline Integration Guide](#7-data-pipeline-integration-guide)
8. [CI/CD Pipeline for Mobile](#8-cicd-pipeline-for-mobile)
9. [Next Steps](#9-next-steps)
10. [Building Off the Current State](#10-building-off-the-current-state)

---

## 1. What Was Built

Crawl v1.0 is a complete frontend shell for a nightlife/bar discovery and voting app. Users can explore venues on a map, filter by category, view venue details with animated hotspot scores, and cast daily votes for the hottest spots in their city.

### Screens Implemented

| Screen | Route | Status |
|--------|-------|--------|
| Explore (Map View) | `/(tabs)/` | Complete — map placeholder, search, filter chips, venue carousel |
| Daily Hotspot Votes | `/(tabs)/voting` | Complete — vote counter, countdown timer, ranked venue list |
| Global Rankings | `/(tabs)/global` | Placeholder |
| Profile | `/(tabs)/profile` | Placeholder |
| Venue Detail | `/venue/[id]` | Complete — animated score ring, highlights, vote CTA |
| Advanced Filters | `/filters` | Complete — transparent modal with toggle switches |

### Key Features

- **Dark theme** with purple (#7f13ec) accent throughout
- **Animated map pins** with pulsing glow for trending venues (react-native-reanimated)
- **Animated hotspot score ring** using react-native-svg with stroke animation
- **Daily vote system** — 3 votes per day with countdown timer to midnight reset
- **Search & filter** — real-time text search + category toggle filters
- **Horizontal venue carousel** with snap-to-card paging
- **Transparent filter modal** overlaying the map screen

---

## 2. Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Expo SDK | 54 |
| UI Framework | React Native | 0.81.5 |
| React | React | 19.1.0 |
| Routing | expo-router (file-based) | 6.0.21 |
| Styling | NativeWind (Tailwind CSS for RN) | latest |
| Animations | react-native-reanimated | 4.1.1 |
| SVG | react-native-svg | 15.x |
| Icons | @expo/vector-icons (Ionicons) | bundled |
| Language | TypeScript (strict mode) | 5.9.2 |
| Linting | ESLint + Prettier | 9.x / 3.x |

### Project Structure

```
crawl/
├── app/                    # Screens & navigation (expo-router file-based)
│   ├── _layout.tsx         # Root: Stack navigator + VenueProvider
│   ├── (tabs)/             # Tab group (bottom tab navigator)
│   │   ├── _layout.tsx     # Tabs config + custom TabBar
│   │   ├── index.tsx       # Explore screen
│   │   ├── voting.tsx      # Voting screen
│   │   ├── global.tsx      # Placeholder
│   │   └── profile.tsx     # Placeholder
│   ├── venue/
│   │   └── [id].tsx        # Dynamic venue detail
│   └── filters.tsx         # Modal overlay
├── components/             # Presentational components
│   ├── layout/             # Navigation chrome
│   ├── map/                # Map-related views
│   ├── ui/                 # Generic reusable UI
│   ├── venue/              # Venue-specific components
│   └── voting/             # Voting-specific components
├── src/                    # Shared logic (aliased as @/*)
│   ├── types/              # TypeScript interfaces
│   ├── data/               # Mock data
│   ├── constants/          # Color tokens, config values
│   ├── context/            # React Context providers
│   └── hooks/              # Custom hooks
├── assets/                 # Static images
└── [config files]          # Babel, Metro, Tailwind, TS, ESLint, Prettier
```

### State Management

State is managed via a single React Context (`VenueContext`) provided at the root layout level. This was chosen over external libraries because the app's state is simple and localized:

```
VenueProvider (app/_layout.tsx)
├── venues: Venue[]              # Full venue list (mock data)
├── filters: FilterOption[]      # Filter toggles
├── searchQuery: string          # Search text
├── selectedCity: string         # Active city
├── voteState: VoteState         # Remaining votes + voted IDs
├── filteredVenues: Venue[]      # Derived: search + filter applied
└── Actions: toggleFilter, resetFilters, castVote, removeVote, etc.
```

---

## 3. File Reference

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (`start`, `lint`, `format`, `prebuild`) |
| `app.json` | Expo config — dark mode, splash screen (#0a0a0f), expo-router plugin |
| `tsconfig.json` | TypeScript strict mode, `@/*` → `src/*` path alias |
| `babel.config.js` | NativeWind JSX transform (`jsxImportSource: 'nativewind'`), worklets plugin |
| `metro.config.js` | Metro bundler with NativeWind CSS processing via `withNativeWind()` |
| `tailwind.config.js` | Custom `crawl-*` color palette, content paths for app/components/src |
| `global.css` | Tailwind directive imports (`@tailwind base/components/utilities`) |
| `eslint.config.js` | Expo flat config + Prettier integration |
| `prettier.config.js` | 100 char width, single quotes, Tailwind class sorting plugin |
| `nativewind-env.d.ts` | TypeScript type declarations for NativeWind `className` prop |

### Screen Files (`app/`)

| File | What It Does |
|------|-------------|
| `app/_layout.tsx` | Root Stack navigator. Wraps the entire app in `VenueProvider`. Defines three routes: `(tabs)` (default), `venue/[id]` (push), and `filters` (transparent modal with fade). Sets dark background (#0a0a0f) and hides all headers. Renders `StatusBar` with `style="light"`. |
| `app/(tabs)/_layout.tsx` | Tab navigator using expo-router `Tabs`. Renders a custom `TabBar` component instead of the default. Defines four tab screens: index, voting, global, profile. |
| `app/(tabs)/index.tsx` | **Explore screen.** Renders `SearchBar` at top with filter button that pushes `/filters`. Below it, a horizontal `ScrollView` of `FilterChip` components for quick toggles. The main area is a `MapPlaceholder` with venue pins. Bottom section is a horizontal `FlatList` carousel of `VenueCard` components with `snapToInterval` for card paging. Tapping a pin or card navigates to `/venue/{id}`. |
| `app/(tabs)/voting.tsx` | **Voting screen.** Header with title and subtitle. `CitySelector` button (currently static). `VoteCounter` showing remaining/max votes. `CountdownTimer` with live HH:MM:SS countdown. Sorted venue list rendered as `VenueListItem` components — each has a heart button to cast/remove votes. |
| `app/(tabs)/global.tsx` | Placeholder with globe icon and "Coming Soon" text. |
| `app/(tabs)/profile.tsx` | Placeholder with person icon and "Coming Soon" text. |
| `app/venue/[id].tsx` | **Venue detail screen.** Reads `id` from URL params, finds venue in mock data. Back button + share button in header. Image placeholder area. Venue name with TRENDING badge. Status row (OPEN/CLOSED badge, hours, price level). `HotspotScore` animated SVG ring showing score. Purple "Vote as Tonight's Hotspot" button. About section with description. Highlights shown as icon+text chips. Location card with address and navigate icon. |
| `app/filters.tsx` | **Filter modal.** Semi-transparent black backdrop (tapping dismisses). Bottom sheet with drag handle. Header with title, Reset button, and close button. List of filters as rows with icon + label + `Switch` toggle. Purple "Apply Filters" button at bottom. Uses `useVenueContext()` for shared state — filter changes are immediately reflected on the Explore screen. |

### Component Files

| File | What It Does |
|------|-------------|
| `components/layout/TabBar.tsx` | Custom bottom tab bar replacing React Navigation default. Four tabs (Explore/compass, Voting/heart, Global/globe, Profile/person). Active tab gets purple highlight background, filled icon, and purple text. Inactive tabs get outline icons and muted text. Handles safe area bottom padding. |
| `components/map/MapPlaceholder.tsx` | Dark-themed map stand-in. Renders a grid pattern (horizontal + vertical lines) to simulate a map. Places `MapPin` components at predetermined percentage positions. Includes `MapControls` overlay. **Designed as a drop-in replacement target** — swap this component with a real `react-native-maps` `MapView` later. |
| `components/map/MapPin.tsx` | Venue pin with optional pulsing glow. Non-trending pins are static dark purple circles with a beer icon. Trending pins get an animated glow ring that scales from 1x to 1.8x and fades from 60% to 0% opacity on a 1500ms infinite loop using `react-native-reanimated`. |
| `components/map/MapControls.tsx` | Three stacked circular buttons (zoom in, zoom out, locate) positioned absolute bottom-right. Currently decorative — no map interaction wired up. |
| `components/ui/SearchBar.tsx` | Row with search input (left) and purple filter button (right). Input has search icon, placeholder text, and muted text color. Filter button triggers `onFilterPress` callback. |
| `components/ui/FilterChip.tsx` | Pressable pill with optional leading icon and label. Active state: purple background, white text. Inactive state: card background, muted text. Used in the Explore screen's horizontal filter strip. |
| `components/ui/Badge.tsx` | Small rounded pill badge. Three variants: `trending` (purple), `open` (green), `closed` (red). Renders uppercase bold white text. Used on venue cards, list items, and detail screen. |
| `components/venue/VenueCard.tsx` | Card for the bottom carousel on Explore. Shows venue name, type, distance, trending/open badges, hotspot score in a purple circle, vote count, price level as dollar signs, up to 3 highlight tags, and a purple "View Details" CTA button. Width is parameterized for carousel snap calculations. |
| `components/venue/HotspotScore.tsx` | Animated SVG circular progress ring. Background circle in dark card color. Foreground progress circle in purple with `strokeDashoffset` animated via `useAnimatedProps` from reanimated. Score number and "Hotspot Score" label centered inside. Animates on mount with cubic easing over 1200ms. Size is configurable (default 140px). |
| `components/venue/VenueListItem.tsx` | Row component for the voting screen ranked list. Left: rank number in a circle. Center: venue name, HOT badge if trending, type + vote count. Right: hotspot score number, and a heart button that toggles voted state. Heart is filled purple when voted, outline when not. Button is disabled when no votes remain and venue hasn't been voted for. |
| `components/voting/VoteCounter.tsx` | Large centered display showing remaining votes (e.g., `3 / 3`). Remaining count is in large purple-light text, max is in smaller muted text. Below: heart icon + "Votes Remaining Today" label. |
| `components/voting/CountdownTimer.tsx` | Live countdown to midnight. Three `TimeBlock` sub-components for hours, minutes, seconds — each in a rounded card-background box with value and label (HRS/MIN/SEC). Purple colon separators between blocks. Powered by `useCountdown` hook. |
| `components/voting/CitySelector.tsx` | Pressable button showing location pin icon, city name, and dropdown chevron. Currently triggers an `onPress` callback (no dropdown implemented). Styled as a rounded pill on card background. |

### Shared Logic (`src/`)

| File | What It Does |
|------|-------------|
| `src/types/venue.ts` | TypeScript interfaces. `Venue`: 16 fields covering identity, location, scoring, status, and display info. `FilterOption`: id, label, icon, enabled toggle. `VoteState`: remaining votes, max votes, list of voted venue IDs. |
| `src/data/venues.ts` | Array of 8 mock venues all located in Austin, TX. Includes a mix of cocktail bars, dive bars, nightclubs, beer gardens, speakeasies, sports bars, live music venues. Hotspot scores range from 71 to 94. 4 are marked as trending. 1 is closed. Price levels range from 1 to 4. Each has 3 highlights and a multi-sentence description. |
| `src/data/filters.ts` | Array of 10 filter options: Trending, Open Now, Live Music, Happy Hour, Rooftop, Craft Cocktails, Dive Bar, Sports Bar, Dancing, Outdoor Patio. Each has an Ionicon name and starts disabled. |
| `src/constants/colors.ts` | Color palette as a `const` object. Matches the Tailwind config values so components using inline `style` props can reference the same palette. |
| `src/context/VenueContext.tsx` | React Context provider and `useVenueContext` hook. Manages: filter state (toggle individual, reset all), search query, city selection, vote state (cast vote decrements remaining and adds venue ID; remove vote reverses). Derives `filteredVenues` by applying search text match (name/type) and active filter checks (trending, open-now) to the full mock venue list. Provided at root layout level so all screens and the filter modal share the same state. |
| `src/hooks/useCountdown.ts` | Custom hook returning `{ hours, minutes, seconds }` as zero-padded strings. Calculates seconds remaining until midnight using `Date` objects. Sets a 1-second `setInterval` on mount and cleans up on unmount. Used by `CountdownTimer` component. |

---

## 4. Design Decisions & Rationale

### Why expo-router file-based routing?

Expo-router maps the file system to the navigation tree, which eliminates manual route registration and keeps navigation discoverable by convention. The `(tabs)` group creates a tab navigator automatically, and dynamic routes like `venue/[id].tsx` handle parameterized URLs. This was chosen over manual React Navigation configuration because:

- Routes are self-documenting — new screens are just new files
- Deep linking comes free (important for sharing venue links later)
- Layout nesting (`_layout.tsx` files) makes it clear where providers and navigation chrome live

### Why NativeWind over StyleSheet or styled-components?

NativeWind provides Tailwind CSS utility classes directly on React Native components via the `className` prop. This was chosen because:

- **Speed of development** — utility classes are faster to write and iterate on than named StyleSheet objects
- **Consistency** — the Tailwind config centralizes the design system (colors, spacing, typography)
- **Tooling** — `prettier-plugin-tailwindcss` auto-sorts classes, reducing bikeshedding
- **Portability** — developers familiar with Tailwind on web can read and write the styles immediately

### Why a map placeholder instead of react-native-maps?

`react-native-maps` requires native module linking, API keys (Google Maps / Apple Maps), and platform-specific setup. For a frontend-first build:

- The placeholder lets the team validate UX flow without native build dependencies
- `MapPlaceholder` accepts the same props a real map component would (venues, onPinPress), so swapping is a one-file change
- Animated pins demonstrate that reanimated works correctly before adding map complexity

### Why React Context instead of Zustand/Redux/Jotai?

The current state is small and co-located:

- Filters, search, and votes are only used across 3 screens
- No async server cache to manage (that would warrant TanStack Query later)
- Context avoids a dependency and keeps the mental model simple
- When a backend is added, the recommendation is to layer TanStack Query for server state and keep Context (or migrate to Zustand) for UI-only state like filter toggles

### Why a single VenueProvider at root instead of per-tab?

The filter modal (`/filters`) is a separate route rendered outside the tab navigator. If the provider lived inside `(tabs)/_layout.tsx`, the modal couldn't read or write filter state. Hoisting the provider to `app/_layout.tsx` ensures all routes share the same state instance.

### Why react-native-svg for the score ring?

The animated circular progress indicator requires partial stroke rendering — specifically `strokeDasharray` and `strokeDashoffset` on an SVG `<Circle>`. This is a well-established SVG technique that:

- Renders identically on iOS and Android
- Integrates with reanimated's `useAnimatedProps` for smooth 60fps animation
- Avoids the complexity of canvas-based alternatives
- Is lightweight — only the `Circle` element is used from the SVG library

### Why Ionicons?

`@expo/vector-icons` ships bundled with every Expo project. Ionicons provides a comprehensive set of outline/filled icon pairs that match the app's design language. No additional dependency needed.

---

## 5. Architecture Diagrams

### 5.1 Current App Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     EXPO RUNTIME                         │
│                   (SDK 54 / RN 0.81)                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ROOT LAYOUT (Stack)                    │ │
│  │          VenueProvider (React Context)              │ │
│  │                                                     │ │
│  │  ┌───────────────────────────────────────────────┐  │ │
│  │  │          TAB NAVIGATOR (Bottom Tabs)          │  │ │
│  │  │              Custom TabBar                    │  │ │
│  │  │                                               │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌─────┐ ┌──────┐  │  │ │
│  │  │  │ Explore  │ │  Voting  │ │Global│ │Profile│  │  │ │
│  │  │  │          │ │          │ │      │ │      │  │  │ │
│  │  │  │SearchBar │ │VoteCount │ │ TBD  │ │ TBD  │  │  │ │
│  │  │  │FilterChip│ │Countdown │ │      │ │      │  │  │ │
│  │  │  │MapPlace- │ │VenueList │ │      │ │      │  │  │ │
│  │  │  │ holder   │ │  Items   │ │      │ │      │  │  │ │
│  │  │  │VenueCard │ │CitySelect│ │      │ │      │  │  │ │
│  │  │  │ Carousel │ │          │ │      │ │      │  │  │ │
│  │  │  └──────────┘ └──────────┘ └─────┘ └──────┘  │  │ │
│  │  └───────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌──────────────────┐  ┌──────────────────────────┐ │ │
│  │  │  Venue Detail    │  │   Filters Modal          │ │ │
│  │  │  /venue/[id]     │  │   /filters               │ │ │
│  │  │                  │  │   (transparentModal)      │ │ │
│  │  │  HotspotScore    │  │                          │ │ │
│  │  │  (SVG + Anim)    │  │   Switch toggles         │ │ │
│  │  │  Highlights      │  │   Reset / Apply          │ │ │
│  │  │  Vote CTA        │  │                          │ │ │
│  │  └──────────────────┘  └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    DATA LAYER                            │
│                                                          │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Mock Venues (8) │  │ Mock Filters │  │ Vote State │ │
│  │  src/data/       │  │ src/data/    │  │ (Context)  │ │
│  │  venues.ts       │  │ filters.ts   │  │ 3 per day  │ │
│  └──────────────────┘  └──────────────┘  └────────────┘ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                 STYLING PIPELINE                         │
│                                                          │
│  Tailwind Config ──► NativeWind/Babel ──► className prop │
│  (crawl-* colors)    (JSX transform)     (RN components) │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              ANIMATION RUNTIME                           │
│                                                          │
│  react-native-reanimated ──► MapPin glow (useSharedValue)│
│  react-native-svg        ──► HotspotScore (strokeDash)   │
│  react-native-worklets   ──► Worklet thread execution    │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Component Dependency Graph

```
                        VenueProvider
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Explore Tab    Voting Tab     Filters Modal
              │              │              │
    ┌─────────┼────────┐     │         Switch toggles
    ▼         ▼        ▼     │
 SearchBar  MapPlace  Venue  │
    │       holder    Card   │
    │         │       Carous.│
    │    ┌────┼────┐         │
    │    ▼    ▼    ▼         │
    │  MapPin Map  Grid      │
    │  (anim) Ctrl Lines     │
    │                        │
    │              ┌─────────┼─────────────┐
    │              ▼         ▼             ▼
    │         VoteCounter  Countdown   VenueListItem
    │                      Timer            │
    │                        │              │
    │                   useCountdown     Badge (HOT)
    │
    ▼
 FilterChip ──► (horizontal scroll row)


            Venue Detail (/venue/[id])
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    HotspotScore  Badge    Highlight
    (SVG + anim)           chips

                 Shared
        ┌────────────────────┐
        │     Badge          │ ◄── used by VenueCard,
        │     Ionicons       │     VenueListItem,
        │     colors.ts      │     Venue Detail
        └────────────────────┘
```

### 5.3 Navigation Flow

```
┌─────────────────────────────────────────────────┐
│                  ROOT STACK                      │
│                                                  │
│   ┌─────────────────────────────────────┐        │
│   │         (tabs) ── default           │        │
│   │                                     │        │
│   │  ┌─────────┐  tap pin   ┌────────┐ │        │
│   │  │ Explore  │──or card──►│ Venue  │ │        │
│   │  │  (map)   │           │ Detail │ │        │
│   │  │         │◄──back─────│/venue/ │ │        │
│   │  │         │           │ [id]   │ │        │
│   │  └────┬────┘           └────────┘ │        │
│   │       │ filter btn                 │        │
│   │       ▼                            │        │
│   │  ┌──────────┐                      │        │
│   │  │ Filters  │ (transparent modal)  │        │
│   │  │ /filters │ backdrop tap = back  │        │
│   │  └──────────┘                      │        │
│   │                                     │        │
│   │  ┌─────────┐  tap venue  ┌────────┐│        │
│   │  │ Voting  │────────────►│ Venue  ││        │
│   │  │  tab    │             │ Detail ││        │
│   │  └─────────┘             └────────┘│        │
│   │                                     │        │
│   │  ┌─────────┐  ┌─────────┐          │        │
│   │  │ Global  │  │ Profile │          │        │
│   │  │  (TBD)  │  │  (TBD)  │          │        │
│   │  └─────────┘  └─────────┘          │        │
│   └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

---

## 6. Maps SDK Integration Guide

When ready to replace the map placeholder with a real map, follow this path:

### 6.1 Architecture with Maps SDK

```
┌─────────────────────────────────────────────────────────┐
│                    EXPLORE SCREEN                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 SearchBar + Chips                   │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              react-native-maps                     │  │
│  │              <MapView>                             │  │
│  │                                                    │  │
│  │    ┌─────────────────────────────┐                 │  │
│  │    │  <Marker coordinate={...}>  │                 │  │
│  │    │    <MapPin venue={v} />     │◄── custom view  │  │
│  │    │  </Marker>                  │    inside Marker │  │
│  │    └─────────────────────────────┘                 │  │
│  │                                                    │  │
│  │    onRegionChange ──► update visible venues        │  │
│  │    onMarkerPress  ──► scroll carousel to venue     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │              VenueCard Carousel                    │  │
│  │   onScroll ──► animate map to venue coordinates    │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

                    DATA FLOW

     MapView                    Carousel
        │                          │
        │  onMarkerPress(venue)    │  onSnapToItem(venue)
        ▼                          ▼
   ┌──────────────────────────────────┐
   │  selectedVenueId (shared state) │
   └──────────────────────────────────┘
        │                          │
        ▼                          ▼
   animateToRegion()         scrollToIndex()
```

### 6.2 Step-by-Step Integration

**Step 1: Install**
```bash
npx expo install react-native-maps
```

**Step 2: API Keys**
- Google Maps: Add key to `app.json` under `android.config.googleMaps.apiKey`
- Apple Maps: Works by default on iOS (no key needed)

**Step 3: Create `components/map/VenueMap.tsx`**

The new component should accept the same props as `MapPlaceholder`:
```typescript
interface VenueMapProps {
  venues: Venue[];
  onPinPress: (venue: Venue) => void;
  selectedVenueId?: string;
  onRegionChange?: (region: Region) => void;
}
```

Key implementation notes:
- Use `customMapStyle` with a dark theme JSON (available from Snazzy Maps or Google's styling wizard)
- Wrap existing `MapPin` components inside `<Marker>` elements using the `coordinate` prop from venue lat/lng
- Add `ref` to MapView for `animateToRegion` calls when carousel selection changes
- The pulsing glow animation on `MapPin` already works with reanimated and will render inside markers

**Step 4: Swap in Explore screen**

In `app/(tabs)/index.tsx`, change:
```typescript
// Before
import { MapPlaceholder } from '../../components/map/MapPlaceholder';
// After
import { VenueMap } from '../../components/map/VenueMap';
```

**Step 5: Bi-directional sync**

Add a `selectedVenueId` state to coordinate map and carousel:
- Tapping a map marker sets `selectedVenueId` and scrolls the carousel
- Scrolling the carousel sets `selectedVenueId` and animates the map

---

## 7. Data Pipeline Integration Guide

### 7.1 Architecture with Backend

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE APP                              │
│                                                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │               UI Layer (current)                 │        │
│  │         Screens + Components (unchanged)         │        │
│  └────────────────────┬─────────────────────────────┘        │
│                       │ reads data from                      │
│  ┌────────────────────▼─────────────────────────────┐        │
│  │          TanStack Query (React Query)             │        │
│  │                                                   │        │
│  │  useVenues(city, filters) ──► cached query        │        │
│  │  useVenue(id)             ──► cached query        │        │
│  │  useVotes()               ──► cached query        │        │
│  │  useCastVote()            ──► mutation + invalidate│       │
│  │  useTrendingVenues(city)  ──► cached query        │        │
│  │                                                   │        │
│  │  staleTime: 30s (venues), 5s (votes)              │        │
│  │  Optimistic updates for vote casting              │        │
│  └────────────────────┬─────────────────────────────┘        │
│                       │ HTTP requests                        │
│  ┌────────────────────▼─────────────────────────────┐        │
│  │              API Client (src/api/)                │        │
│  │                                                   │        │
│  │  src/api/client.ts     ── fetch wrapper / axios   │        │
│  │  src/api/venues.ts     ── getVenues, getVenue     │        │
│  │  src/api/votes.ts      ── castVote, getVoteState  │        │
│  │  src/api/auth.ts       ── login, register, token  │        │
│  └────────────────────┬─────────────────────────────┘        │
└───────────────────────┼──────────────────────────────────────┘
                        │
                   HTTPS / WSS
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                     API GATEWAY                               │
│              (e.g., AWS API Gateway / Cloudflare)             │
│                                                               │
│  /api/v1/venues          GET     ── list with filters         │
│  /api/v1/venues/:id      GET     ── single venue detail       │
│  /api/v1/votes           GET     ── user's vote state         │
│  /api/v1/votes           POST    ── cast a vote               │
│  /api/v1/votes/:id       DELETE  ── remove a vote             │
│  /api/v1/trending/:city  GET     ── ranked venues for city    │
│  /api/v1/auth/login      POST    ── authenticate              │
│  /api/v1/auth/register   POST    ── create account            │
│  /ws/live                WSS     ── real-time score updates   │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   BACKEND SERVICES                            │
│                                                               │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Venue Service   │  │ Vote Service │  │  Auth Service   │  │
│  │                  │  │              │  │                 │  │
│  │  CRUD venues     │  │  Cast vote   │  │  JWT tokens     │  │
│  │  Search/filter   │  │  Daily reset │  │  OAuth2         │  │
│  │  Geo queries     │  │  Aggregate   │  │  User profiles  │  │
│  │                  │  │  scores      │  │                 │  │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬────────┘  │
│           │                   │                    │           │
│  ┌────────▼───────────────────▼────────────────────▼────────┐ │
│  │                    DATABASE LAYER                         │ │
│  │                                                           │ │
│  │  PostgreSQL (primary)           Redis (cache + realtime)  │ │
│  │  ├── venues table               ├── vote counts           │ │
│  │  ├── users table                ├── session tokens        │ │
│  │  ├── votes table                ├── trending leaderboard  │ │
│  │  ├── highlights table           └── pub/sub for live      │ │
│  │  └── PostGIS for geo queries        score updates         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    SCHEDULED JOBS                          │ │
│  │                                                           │ │
│  │  Midnight CRON ──► reset daily votes, snapshot scores     │ │
│  │  Hourly CRON   ──► recalculate hotspot scores             │ │
│  │  Venue Sync    ──► import from Google Places / Yelp API   │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 Migration Path from Mock Data

The migration is designed to be incremental. Each step is independently deployable:

**Phase A: Add API client layer**
- Install `@tanstack/react-query`
- Create `src/api/client.ts` with a configured fetch/axios instance
- Create query hooks in `src/api/` that initially still return mock data

**Phase B: Replace VenueContext with TanStack Query**
- Replace `venues` and `filteredVenues` with `useQuery` hooks
- Keep `voteState` in Context or Zustand for optimistic UI
- Remove mock data imports from components

**Phase C: Wire up vote mutations**
- `useMutation` for castVote/removeVote with optimistic updates
- Invalidate vote queries on mutation success
- Add error handling and rollback

**Phase D: Add authentication**
- Auth context with JWT token storage (expo-secure-store)
- Protected route wrapper
- Login/register screens under `app/(auth)/`

**Phase E: Real-time updates**
- WebSocket connection for live score changes
- Update TanStack Query cache on WS messages
- Animated score transitions in UI (already supported by HotspotScore component)

---

## 8. CI/CD Pipeline for Mobile

### 8.1 Pipeline Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                        │
│                                                                  │
│   Local Dev ──► git push ──► Pull Request ──► Code Review        │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      CI PIPELINE (GitHub Actions)                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 1: Validate (runs on every push/PR)              │     │
│  │                                                         │     │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │     │
│  │  │ Install  │─►│  Lint    │─►│TypeCheck  │─►│  Test  │ │     │
│  │  │   deps   │  │(eslint + │  │(tsc       │  │(jest / │ │     │
│  │  │(npm ci)  │  │prettier) │  │--noEmit)  │  │ e2e)   │ │     │
│  │  └──────────┘  └──────────┘  └───────────┘  └────────┘ │     │
│  │                                                         │     │
│  │  ✗ Any failure ──► block merge                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                    merge to main                                 │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 2: Build (runs on merge to main)                 │     │
│  │                                                         │     │
│  │  ┌──────────────────────────────────────────────────┐   │     │
│  │  │              EAS Build (Expo)                     │   │     │
│  │  │                                                  │   │     │
│  │  │  ┌─────────────────┐  ┌────────────────────┐     │   │     │
│  │  │  │  iOS Build      │  │  Android Build     │     │   │     │
│  │  │  │                 │  │                    │     │   │     │
│  │  │  │  Profile:       │  │  Profile:          │     │   │     │
│  │  │  │  "preview"      │  │  "preview"         │     │   │     │
│  │  │  │  (internal      │  │  (APK for          │     │   │     │
│  │  │  │  distribution)  │  │  internal testing)  │     │   │     │
│  │  │  │                 │  │                    │     │   │     │
│  │  │  │  Simulator/     │  │  Emulator/         │     │   │     │
│  │  │  │  TestFlight     │  │  Firebase App      │     │   │     │
│  │  │  │                 │  │  Distribution      │     │   │     │
│  │  │  └─────────────────┘  └────────────────────┘     │   │     │
│  │  └──────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                    builds complete                                │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 3: Distribute (automatic after build)            │     │
│  │                                                         │     │
│  │  ┌─────────────────┐  ┌───────────────────────────┐     │     │
│  │  │  Internal Test   │  │  QA Team Notification     │     │     │
│  │  │                 │  │                           │     │     │
│  │  │  iOS: TestFlight│  │  Slack webhook with       │     │     │
│  │  │  (internal)     │  │  build link + changelog   │     │     │
│  │  │                 │  │                           │     │     │
│  │  │  Android:       │  │  Auto-generated from      │     │     │
│  │  │  Firebase App   │  │  commit messages since    │     │     │
│  │  │  Distribution   │  │  last build               │     │     │
│  │  └─────────────────┘  └───────────────────────────┘     │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
           │
     manual approval / git tag
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    RELEASE PIPELINE                               │
│              (triggered by git tag: v1.x.x)                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 4: Production Build                              │     │
│  │                                                         │     │
│  │  EAS Build with profile: "production"                   │     │
│  │                                                         │     │
│  │  iOS: .ipa (signed with distribution cert)              │     │
│  │  Android: .aab (signed with upload key)                 │     │
│  │                                                         │     │
│  │  ┌─────────────────────────────────────────────────┐    │     │
│  │  │  OTA Check: Can this be an OTA update?          │    │     │
│  │  │                                                 │    │     │
│  │  │  YES (JS-only changes) ──► EAS Update           │    │     │
│  │  │    expo-updates pushes JS bundle                │    │     │
│  │  │    No app store review needed                   │    │     │
│  │  │    Users get update on next launch              │    │     │
│  │  │                                                 │    │     │
│  │  │  NO (native changes) ──► Full binary submit     │    │     │
│  │  │    New native modules, SDK upgrade, etc.        │    │     │
│  │  └─────────────────────────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 5: Store Submission                              │     │
│  │                                                         │     │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │     │
│  │  │  EAS Submit (iOS)   │  │  EAS Submit (Android)    │  │     │
│  │  │                     │  │                          │  │     │
│  │  │  eas submit -p ios  │  │  eas submit -p android   │  │     │
│  │  │                     │  │                          │  │     │
│  │  │  ──► App Store      │  │  ──► Google Play Console  │  │     │
│  │  │  Connect            │  │  (internal/beta/prod     │  │     │
│  │  │  (TestFlight ──►    │  │   track)                 │  │     │
│  │  │   App Review ──►    │  │                          │  │     │
│  │  │   Release)          │  │                          │  │     │
│  │  └─────────────────────┘  └──────────────────────────┘  │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 6: Post-Release                                  │     │
│  │                                                         │     │
│  │  • Sentry / Bugsnag error monitoring enabled            │     │
│  │  • Analytics events verified (Mixpanel / Amplitude)     │     │
│  │  • GitHub Release created with changelog                │     │
│  │  • Rollback plan: previous EAS Update channel           │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Key Tools

| Tool | Purpose |
|------|---------|
| **EAS Build** | Expo's cloud build service. Builds iOS/Android binaries without local Xcode/Android Studio. Configure via `eas.json` with build profiles (development, preview, production). |
| **EAS Submit** | Automates store submission. Uploads .ipa to App Store Connect and .aab to Google Play Console. |
| **EAS Update** | Over-the-air JS bundle updates. Bypasses app store review for JS-only changes. |
| **GitHub Actions** | CI runner. Triggers on push/PR for validation, on merge for builds, on tag for releases. |

### 8.3 Recommended `eas.json`

```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "./google-service-account.json" }
    }
  }
}
```

---

## 9. Next Steps

### Immediate (v1.1)

| Priority | Task | Effort |
|----------|------|--------|
| High | Set up test suite (Jest + React Native Testing Library) | 1 day |
| High | Replace MapPlaceholder with `react-native-maps` | 2 days |
| High | Build auth screens (login, register, onboarding) | 2 days |
| Medium | Implement city selector dropdown with list of cities | 0.5 day |
| Medium | Add venue image support (placeholder → real images) | 1 day |
| Medium | Implement Global Rankings screen with mock data | 1 day |
| Medium | Implement Profile screen (avatar, stats, voting history) | 1 day |
| Low | Add haptic feedback on vote cast | 0.5 day |
| Low | Add pull-to-refresh on voting screen | 0.5 day |

### Short Term (v1.2)

| Task | Effort |
|------|--------|
| Set up EAS Build + CI pipeline (see section 8) | 1 day |
| Integrate TanStack Query + API client layer | 2 days |
| Build backend API (venues, votes, auth endpoints) | 3-5 days |
| Add push notifications for trending alerts | 1 day |
| Implement venue bookmarking / favorites | 1 day |
| Add accessibility labels and screen reader support | 1 day |

### Medium Term (v2.0)

| Task | Effort |
|------|--------|
| Real-time vote updates via WebSocket | 2 days |
| Social features (friends, group crawls) | 5 days |
| Venue check-in system | 2 days |
| Review and rating system | 3 days |
| Bar crawl route planning | 3 days |
| Admin dashboard for venue owners | 5 days |

---

## 10. Building Off the Current State

### Adding a New Screen

1. Create a file under `app/` — the path becomes the route
2. For a tab screen: add to `app/(tabs)/` and register in `(tabs)/_layout.tsx`
3. For a stack screen: add to `app/` root or a subfolder, register in `app/_layout.tsx`

Example — adding a "Favorites" tab:
```bash
# 1. Create the screen
touch app/(tabs)/favorites.tsx

# 2. Add to tabs layout
# In app/(tabs)/_layout.tsx, add: <Tabs.Screen name="favorites" />

# 3. Add to TabBar
# In components/layout/TabBar.tsx, add entry to `tabs` array:
# { name: '(tabs)/favorites', label: 'Favorites', icon: 'bookmark' }
```

### Adding a New Component

Place under `components/` in the appropriate subdirectory:
- `ui/` — generic, reusable across features
- `venue/` — venue-specific display components
- `map/` — map-related components
- `voting/` — voting feature components

All components should:
- Accept data via props (not import context directly when possible)
- Use NativeWind `className` for styling
- Use Ionicons from `@expo/vector-icons` for icons
- Follow the existing color palette (`crawl-*` Tailwind classes)

### Adding Shared Logic

Place under `src/` using the `@/` import alias:
- `src/types/` — TypeScript interfaces and type definitions
- `src/hooks/` — custom React hooks
- `src/api/` — API client functions (when backend exists)
- `src/utils/` — pure utility functions
- `src/context/` — React Context providers
- `src/constants/` — configuration values and enums

### Modifying the Color Palette

Colors are defined in two places that must stay in sync:
1. `tailwind.config.js` — for `className` usage (e.g., `bg-crawl-purple`)
2. `src/constants/colors.ts` — for inline `style` prop usage (e.g., `color={colors.purple}`)

### State Management Guidelines

- **UI state** (filters, toggles, selections): React Context or Zustand
- **Server state** (venues, votes, user data): TanStack Query when backend exists
- **Form state**: React Hook Form or local component state
- **Navigation state**: Managed by expo-router automatically
- **Persistent state** (auth tokens, preferences): expo-secure-store or AsyncStorage

### Code Quality Checklist

Before submitting changes:
```bash
npm run lint      # ESLint + Prettier check (must pass with 0 errors)
npm run format    # Auto-fix formatting
npm start         # Verify app launches and navigates correctly
```
