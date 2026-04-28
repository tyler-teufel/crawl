# Architecture

This document covers the project structure, navigation, state management, styling pipeline, and system diagrams for the Crawl app.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Navigation Architecture](#2-navigation-architecture)
3. [State Management](#3-state-management)
4. [Styling Pipeline](#4-styling-pipeline)
5. [Animation Runtime](#5-animation-runtime)
6. [System Diagrams](#6-system-diagrams)

---

## 1. Project Structure

```
crawl/
├── app/                        # Screens & navigation (expo-router file-based)
│   ├── _layout.tsx             # Root: Stack + ThemeProvider + AuthProvider
│   │                           #         + VenueProvider + OnboardingGate
│   ├── (onboarding)/           # First-launch group (gated by AsyncStorage flag)
│   │   ├── _layout.tsx         # Stack, dark backdrop
│   │   ├── index.tsx           # Welcome / brand splash
│   │   ├── location.tsx        # Foreground location prompt (skippable)
│   │   └── auth.tsx            # Apple / Google / anonymous entry
│   ├── (tabs)/                 # Tab group (bottom tab navigator)
│   │   ├── _layout.tsx         # Tabs config + custom TabBar
│   │   ├── index.tsx           # Explore screen (map + carousel)
│   │   ├── voting.tsx          # Daily voting screen
│   │   ├── global.tsx          # Placeholder
│   │   └── profile.tsx         # Placeholder
│   ├── venue/
│   │   └── [id].tsx            # Dynamic venue detail
│   └── filters.tsx             # Transparent modal overlay
├── components/                 # Presentational components
│   ├── layout/                 # Navigation chrome (TabBar)
│   ├── map/                    # Map placeholder, pins, controls
│   ├── ui/                     # Generic reusable UI (SearchBar, Badge, etc.)
│   ├── venue/                  # Venue-specific (VenueCard, HotspotScore, etc.)
│   └── voting/                 # Voting-specific (VoteCounter, CountdownTimer, etc.)
├── src/                        # Shared logic (aliased as @/*)
│   ├── types/                  # TypeScript interfaces
│   ├── data/                   # Mock data (venues, filters)
│   ├── constants/              # Color tokens
│   ├── context/                # React Context providers (VenueContext)
│   ├── hooks/                  # Custom hooks (useCountdown)
│   └── lib/                    # Utility functions (cn, theme)
├── assets/                     # Static images (icon, splash)
├── docs/                       # Documentation
└── [config files]              # Babel, Metro, Tailwind, TS, ESLint, Prettier
```

### Directory Conventions

| Directory     | Convention                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`        | One file = one route. `_layout.tsx` files define navigation containers. Parenthesized directories like `(tabs)` create layout groups without affecting the URL. |
| `components/` | Presentational components organized by feature domain. Accept data via props. Minimal direct context usage.                                                     |
| `src/`        | Business logic, types, data, and utilities. Everything here is imported via the `@/` alias (e.g., `@/types/venue`).                                             |
| `src/lib/`    | Utility functions used across the app. Currently houses `cn()` and `theme.ts` for RNR integration.                                                              |

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`):

```typescript
import { Venue } from '@/types/venue'; // → src/types/venue.ts
import { cn } from '@/lib/utils'; // → src/lib/utils.ts
import { useCountdown } from '@/hooks/useCountdown'; // → src/hooks/useCountdown.ts
```

---

## 2. Navigation Architecture

### Route Tree

```
Root Stack (app/_layout.tsx)
├── (onboarding)                    # First-launch only (AsyncStorage gate)
│   ├── index        → /           # Welcome splash
│   ├── location     → /location   # Foreground location prompt (skippable)
│   └── auth         → /auth       # Apple / Google / anonymous
├── (tabs)                          # Tab navigator
│   ├── index        → /           # Explore (default tab)
│   ├── voting       → /voting     # Daily votes
│   ├── global       → /global     # Placeholder
│   └── profile      → /profile    # Placeholder
├── venue/[id]       → /venue/123  # Venue detail (push)
└── filters          → /filters    # Filter modal (transparentModal)
```

### First-Launch Gate

`app/_layout.tsx` renders an `OnboardingGate` component that reads
`crawl.firstLaunchComplete.v1` from AsyncStorage. Until the flag is set, the
gate emits `<Redirect href="/(onboarding)" />` so the user lands on the
welcome splash. The flag is written by `markOnboardingComplete()` after the
user picks an auth path on `/auth`. Subsequent launches skip the onboarding
group entirely. Reinstalling the app clears AsyncStorage and restarts the
flow.

### Navigation Stack Behavior

| Route        | Presentation              | Animation          | Tab Bar                  |
| ------------ | ------------------------- | ------------------ | ------------------------ |
| `(tabs)/*`   | Default (fullscreen)      | None (tab switch)  | Visible                  |
| `venue/[id]` | Default (fullscreen push) | `slide_from_right` | Hidden                   |
| `filters`    | `transparentModal`        | `fade`             | Visible (behind overlay) |

### Custom Tab Bar

The default React Navigation tab bar is replaced by `components/layout/TabBar.tsx`. It provides:

- Dark background matching `crawl-bg`
- Purple active indicator with filled icon
- Outline icons for inactive tabs
- Safe area bottom padding
- Four tabs: Explore (compass), Voting (heart), Global (globe), Profile (person)

### Navigation Flow Diagram

```
┌──────────────────────────────────────────────┐
│                 ROOT STACK                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         (tabs) ── default              │  │
│  │                                        │  │
│  │  ┌──────────┐  tap pin   ┌──────────┐ │  │
│  │  │ Explore  │──or card──►│  Venue   │ │  │
│  │  │  (map)   │            │  Detail  │ │  │
│  │  │          │◄──back─────│ /venue/  │ │  │
│  │  │          │            │  [id]    │ │  │
│  │  └────┬─────┘            └──────────┘ │  │
│  │       │ filter btn                    │  │
│  │       ▼                               │  │
│  │  ┌────────────┐                       │  │
│  │  │  Filters   │ (transparent modal)   │  │
│  │  │  /filters  │ backdrop tap = back   │  │
│  │  └────────────┘                       │  │
│  │                                        │  │
│  │  ┌──────────┐  tap venue ┌──────────┐ │  │
│  │  │ Voting   │───────────►│  Venue   │ │  │
│  │  │  tab     │            │  Detail  │ │  │
│  │  └──────────┘            └──────────┘ │  │
│  │                                        │  │
│  │  ┌──────────┐  ┌──────────┐           │  │
│  │  │ Global   │  │ Profile  │           │  │
│  │  │  (TBD)   │  │  (TBD)   │           │  │
│  │  └──────────┘  └──────────┘           │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 3. State Management

### Current Approach: React Context

Shared state lives in two providers stacked at the root layout level.
`AuthProvider` sits above `VenueProvider` so any future query in
`VenueProvider` can read the user.

```
AuthProvider (app/_layout.tsx)
│
├── Identity
│   ├── user: User | null            # Supabase auth user (anon or linked)
│   ├── isAnonymous: boolean         # is_anonymous flag from supabase-js
│   └── initializing: boolean        # true until first getSession resolves
│
├── Onboarding capture
│   ├── userLocation: { latitude, longitude } | null
│   └── setUserLocation(loc)
│
└── Actions
    ├── linkApple()                  # Apple ID-token sign-in / link
    ├── linkGoogle()                 # Google ID-token sign-in / link
    └── signOut()
        │
        ▼
VenueProvider (app/_layout.tsx, beneath AuthProvider)
│
├── Data
│   ├── venues: Venue[]              # Server-filtered for selectedCity + active chips
│   ├── filteredVenues: Venue[]      # Derived: client-side search-text filter only
│   ├── filters: FilterOption[]      # 10 filter toggles (server-side application)
│   ├── searchQuery: string          # Current search text (client-side)
│   └── selectedCity: string         # Seeded from AuthContext.userLocation via
│                                    #   findNearestCity(); user override via
│                                    #   setSelectedCity, persisted as a guard ref
│
├── Vote State
│   ├── voteState.remainingVotes: number     # Starts at 3
│   ├── voteState.maxVotes: number           # Always 3
│   └── voteState.votedVenueIds: string[]    # IDs of voted venues
│
└── Actions
    ├── setSearchQuery(q)            # Update search text
    ├── setSelectedCity(city)        # Change city
    ├── toggleFilter(id)             # Toggle individual filter
    ├── resetFilters()               # Reset all filters to disabled
    ├── castVote(venueId)            # Use a vote (if remaining > 0)
    └── removeVote(venueId)          # Undo a vote (restore to remaining)
```

`AuthProvider` subscribes to `supabase.auth.onAuthStateChange` so the
`user` and `isAnonymous` fields update automatically when an anonymous
user is upgraded to a permanent identity via Apple or Google linking.

### Why Context at Root?

The filter modal (`/filters`) is rendered as a separate route outside the tab navigator. If the provider lived inside `(tabs)/_layout.tsx`, the modal couldn't access filter state. Hoisting the provider to `app/_layout.tsx` ensures all routes — tabs, modals, and stack screens — share the same state.

### Derived State

`filteredVenues` is the search-narrowed view of the already-filtered server result. The filter chips are applied server-side now (`useVenues` composes Supabase predicates per active filter — see [Dynamic Venue Filtering Strategy](./DESIGN_DECISIONS.md#dynamic-venue-filtering-strategy)), so the only client-side filter that remains is search text:

- **Search filter (client):** case-insensitive match against `name` or `primaryType`. Runs on every keystroke.
- **Category filters (server):** every chip toggle invalidates the `venues.list` queryKey, which triggers a refetch with the new predicate set.
- **City scope (server):** changing `selectedCity` invalidates both the `venues.list` and `votes.state` queryKeys so the map, carousel, voting screen, and rankings all re-fetch in lockstep.

### Future State Architecture

When a backend is added, the recommendation is:

| State Type                  | Current       | Future                                      |
| --------------------------- | ------------- | ------------------------------------------- |
| Server data (venues, votes) | React Context | TanStack Query (cached queries + mutations) |
| UI state (filters, search)  | React Context | React Context or Zustand                    |
| Auth state (tokens, user)   | N/A           | Zustand + expo-secure-store                 |
| Form state                  | N/A           | React Hook Form or local state              |
| Navigation state            | expo-router   | expo-router (unchanged)                     |

---

## 4. Styling Pipeline

### How NativeWind Processes Styles

```
tailwind.config.js          Defines utility classes + custom tokens
        │
        ▼
global.css                  CSS variables (@layer base) + Tailwind directives
        │
        ▼
metro.config.js             withNativeWind() processes CSS at build time
(inlineRem: 16)             Converts rem → 16px base for native
        │
        ▼
babel.config.js             jsxImportSource: 'nativewind' transforms JSX
(nativewind preset)         className → style prop at compile time
        │
        ▼
Component                   <View className="bg-primary p-4 rounded-lg" />
                            Rendered with computed native styles
```

### Two Color Systems

| System          | Source                                | Example Classes                                             | When to Use                                            |
| --------------- | ------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Semantic tokens | CSS variables in `global.css`         | `bg-primary`, `text-muted-foreground`, `border-border`      | RNR components, new components following design system |
| Crawl palette   | Hardcoded hex in `tailwind.config.js` | `bg-crawl-purple`, `text-crawl-text-muted`, `bg-crawl-card` | Existing custom components, one-off color needs        |

Both systems coexist. The semantic tokens automatically adapt to light/dark mode. The `crawl-*` tokens are static.

### Tailwind Content Paths

The `tailwind.config.js` content array tells Tailwind which files to scan for class usage:

```javascript
content: [
  './app/**/*.{js,ts,tsx}',              // Screen files
  './components/**/*.{js,ts,tsx}',       // Custom components
  './src/**/*.{js,ts,tsx}',              // Shared logic
  './node_modules/@rnr/**/*.{ts,tsx}',   // RNR component primitives
],
```

The `@rnr` path is critical — without it, Tailwind would purge classes used inside RNR components.

### Prettier Class Sorting

`prettier-plugin-tailwindcss` automatically sorts Tailwind classes in `className` props. This ensures consistent ordering across the codebase without manual effort.

---

## 5. Animation Runtime

### react-native-reanimated

Used for performant, 60fps animations that run on the UI thread:

| Component      | Animation                             | Technique                                                                                       |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MapPin`       | Pulsing glow ring for trending venues | `withRepeat` + `withTiming` on shared values for scale (1→1.8) and opacity (0.6→0), 1500ms loop |
| `HotspotScore` | Circular progress ring fill           | `useAnimatedProps` driving `strokeDashoffset` on an SVG `<Circle>`, cubic easing, 1200ms        |

### react-native-svg

Provides the `<Svg>`, `<Circle>` elements used by `HotspotScore`. The `AnimatedCircle` is created via `Animated.createAnimatedComponent(Circle)` to enable reanimated-driven SVG attribute animation.

### react-native-worklets

Provides the worklet runtime that reanimated uses to execute animation code on the UI thread. Configured via the Babel plugin in `babel.config.js`.

---

## 6. System Diagrams

### Full App Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     EXPO RUNTIME                         │
│                   (SDK 54 / RN 0.81)                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ROOT LAYOUT (Stack)                    │ │
│  │       ThemeProvider + VenueProvider + PortalHost    │ │
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
│  │  │  HotspotScore    │  │   (transparentModal)     │ │ │
│  │  │  (SVG + Anim)    │  │   Switch toggles         │ │ │
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
│  global.css ──► Tailwind Config ──► NativeWind/Babel     │
│  (CSS vars)    (crawl-* + tokens)   (className → style)  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              ANIMATION RUNTIME                           │
│                                                          │
│  react-native-reanimated ──► MapPin glow, HotspotScore   │
│  react-native-svg        ──► Circle strokeDashoffset     │
│  react-native-worklets   ──► UI thread execution         │
└──────────────────────────────────────────────────────────┘
```

### Component Dependency Graph

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
        │     cn()           │     Venue Detail
        └────────────────────┘
```
