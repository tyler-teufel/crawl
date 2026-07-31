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
7. [Backend Architecture](#7-backend-architecture)

---

## 1. Project Structure

Crawl is a Turborepo monorepo. The mobile app and API server are separate workspaces that share validated types from `packages/shared-types`.

```
crawl/
├── apps/
│   ├── mobile/                     # Expo React Native app
│   │   ├── app/                    # Screens & navigation (expo-router file-based)
│   │   │   ├── _layout.tsx         # Root: Stack + ThemeProvider + AuthProvider
│   │   │   │                       #         + VenueProvider + OnboardingGate
│   │   │   ├── (onboarding)/       # First-launch group (gated by AsyncStorage flag)
│   │   │   │   ├── _layout.tsx     # Stack, dark backdrop
│   │   │   │   ├── index.tsx       # Welcome / brand splash
│   │   │   │   ├── location.tsx    # Foreground location prompt (skippable)
│   │   │   │   └── auth.tsx        # Apple / Google / anonymous entry
│   │   │   ├── (tabs)/             # Tab group (bottom tab navigator)
│   │   │   │   ├── _layout.tsx     # Tabs config + custom TabBar
│   │   │   │   ├── index.tsx       # Explore screen (map + carousel)
│   │   │   │   ├── voting.tsx      # Daily voting screen
│   │   │   │   ├── global.tsx      # Global Rankings (city leaderboard)
│   │   │   │   └── profile.tsx     # Profile (avatar, history, stats, sign-out)
│   │   │   ├── venue/
│   │   │   │   └── [id].tsx        # Dynamic venue detail
│   │   │   └── filters.tsx         # Transparent modal overlay
│   │   ├── components/             # Presentational components
│   │   │   ├── layout/             # Navigation chrome (TabBar)
│   │   │   ├── map/                # Map view, pins, controls
│   │   │   ├── ui/                 # Generic reusable UI (SearchBar, Badge, etc.)
│   │   │   ├── venue/              # Venue-specific (VenueCard, HotspotScore, etc.)
│   │   │   └── voting/             # Voting-specific (VoteCounter, CountdownTimer, etc.)
│   │   ├── src/                    # Shared logic (aliased as @/*)
│   │   │   ├── types/              # TypeScript interfaces
│   │   │   ├── data/                # Bundled fallback/mock data (venues, filters)
│   │   │   ├── constants/            # Color tokens
│   │   │   ├── context/              # AuthContext, VenueContext
│   │   │   ├── api/                  # TanStack Query hooks + API client
│   │   │   ├── hooks/                # Custom hooks (useCountdown)
│   │   │   └── lib/                  # Utilities (cn, theme, auth, onboarding, sentry, supabase)
│   │   ├── assets/                 # Static images, brand assets, fonts
│   │   └── tests/                  # Vitest tests
│   └── api/                        # Fastify API server
│       ├── src/
│       │   ├── routes/             # HTTP handlers (venues, votes, trending, auth, health)
│       │   ├── services/           # Business logic (venue, vote, auth)
│       │   ├── repositories/       # DB access — in-memory + Drizzle implementations
│       │   ├── plugins/            # cors, jwt (dual-mode auth), error-handler
│       │   ├── jobs/                # node-cron scheduled tasks + venue sync
│       │   └── db/                  # Drizzle schema
│       ├── drizzle/                # SQL migrations
│       └── tests/
├── packages/
│   ├── shared-types/                # Zod schemas + TS types shared by mobile and API
│   └── eslint-config/                # Shared ESLint config
├── docs/                             # Documentation
└── [config files]                    # turbo.json, root package.json, etc.
```

### Directory Conventions

| Directory              | Convention                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/app/`      | One file = one route. `_layout.tsx` files define navigation containers. Parenthesized directories like `(tabs)` create layout groups without affecting the URL. |
| `apps/mobile/components/` | Presentational components organized by feature domain. Accept data via props. Minimal direct context usage.                                                     |
| `apps/mobile/src/`       | Business logic, types, data, and utilities. Everything here is imported via the `@/` alias (e.g., `@/types/venue`).                                             |
| `apps/mobile/src/lib/`   | Utility functions used across the app: `cn()`, `theme.ts`, `auth.ts`, `onboarding.ts`, `sentry.ts`, `supabase.ts`.                                               |
| `apps/api/src/`          | Route handler → service → repository layering (see [§7 Backend Architecture](#7-backend-architecture)).                                                          |

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
│   ├── auth         → /auth       # Apple / Google / anonymous
│   └── name         → /name       # Display-name prompt (skippable)
├── (tabs)                          # Tab navigator
│   ├── index        → /           # Explore (default tab)
│   ├── voting       → /voting     # Daily votes
│   ├── global       → /global     # Global Rankings (city leaderboard)
│   └── profile      → /profile    # Profile (user avatar, history, stats)
├── venue/[id]       → /venue/123  # Venue detail (push)
└── filters          → /filters    # Filter modal (transparentModal)
```

### First-Launch Gate

`app/_layout.tsx` renders an `OnboardingGate` component that derives onboarding
completion from two independent signals: (1) the `crawl.firstLaunchComplete.v1`
AsyncStorage flag, and (2) whether a Supabase session already existed before
this launch's auth bootstrap (#158). A returning user with a persisted session
is considered already onboarded even if the flag is unset, since they completed
auth in a prior launch. The gate holds a `'loading'` state until both async
reads settle, preventing a race-condition redirect on the session read's stale
`false` default. The flag is written by `markOnboardingComplete()` at the end
of the flow (the `/name` step, not `/auth` — writing it earlier would let the
gate redirect past the name prompt), and it gates the welcome, location, auth,
and name screens for new installs. Subsequent launches skip the onboarding
group if either signal says done; reinstalling the app clears AsyncStorage and
Supabase storage, restarting the flow.

The gate redirects in **both** directions (`resolveOnboardingRedirect()`):
`/` is claimed by two index routes — `(onboarding)/index` and `(tabs)/index` —
and expo-router resolves that ambiguity in `(onboarding)`'s favor, so every
cold start renders the welcome screen first. Redirecting only *into* onboarding
therefore re-prompted an already-onboarded user for sign-in on every launch;
the 'done' branch routes them back into `(tabs)`. Sign-out is the inverse case:
`AuthContext.signOut()` clears the flag (`clearOnboardingFlag()`) and the gate
drops `hasReturningSession` on the `SIGNED_OUT` auth event, so a signed-out
user isn't bounced straight back into the tabs. The gate's auth listener only
ever *clears* that flag — a session appearing mid-run is the anonymous
bootstrap for a brand-new install and must not count as "returning".

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
│  │  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │    Global    │  │   Profile    │   │  │
│  │  │  Rankings    │  │ (avatar, etc)│   │  │
│  │  └──────────────┘  └──────────────┘   │  │
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
├── Vote State (GLOBAL per user per day, not per-city)
│   ├── voteState.remainingVotes: number     # Starts at 3, decremented across all cities
│   ├── voteState.maxVotes: number           # Always 3
│   └── voteState.votedVenueIds: string[]    # IDs of voted venues (global scope)
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

#### Auth Flow Diagram

The complete end-to-end auth flow — including anonymous boot, identity upgrade,
authenticated API requests, and token lifecycle — is documented as an SVG diagram:

**[`docs/architecture/auth-flow.svg`](./auth-flow.svg)**

The diagram covers four phases:
1. **App Boot** — `ensureSignedIn()` checks AsyncStorage; creates an anonymous Supabase
   session if none exists; injects `access_token` into the API client via `setAuthToken()`.
2. **Identity Upgrade** — user links Apple (iOS) or Google via `signInWithIdToken()`;
   Supabase upgrades the anonymous user in-place, preserving the UUID and all existing data.
3. **Authenticated API Requests** — `apiClient` attaches `Authorization: Bearer <token>` to
   every request; Fastify verifies the JWT using `SUPABASE_JWT_SECRET`.
4. **Token Lifecycle** — Supabase auto-refreshes the access token before expiry; `signOut()`
   clears the session and sets the API client token to `null`.

### Why Context at Root?

The filter modal (`/filters`) is rendered as a separate route outside the tab navigator. If the provider lived inside `(tabs)/_layout.tsx`, the modal couldn't access filter state. Hoisting the provider to `app/_layout.tsx` ensures all routes — tabs, modals, and stack screens — share the same state.

### Derived State

`filteredVenues` is the search-narrowed view of the already-filtered server result. The filter chips are applied server-side now (`useVenues` composes Supabase predicates per active filter — see [Dynamic Venue Filtering Strategy](./DESIGN_DECISIONS.md#dynamic-venue-filtering-strategy)), so the only client-side filter that remains is search text:

- **Search filter (client):** case-insensitive match against `name` or `primaryType`. Runs on every keystroke.
- **Category filters (server):** every chip toggle invalidates the `venues.list` queryKey, which triggers a refetch with the new predicate set.
- **City scope (server):** changing `selectedCity` invalidates both the `venues.list` and `votes.state` queryKeys so the map, carousel, voting screen, and rankings all re-fetch in lockstep.

### Three-Tier Read Fallback (v1.1.0 live-data cutover)

The mobile app's read operations on venues and cities follow a priority fallback chain — enabling incremental backend adoption without hard platform dependencies:

```
    EXPO_PUBLIC_API_URL set?
              │
              ├─ yes ──► Call Railway API ──► return results
              │         (/api/v1/venues,
              │          /api/v1/trending, etc.)
              │
              └─ no ──► EXPO_PUBLIC_SUPABASE_URL set?
                               │
                               ├─ yes ──► Query Supabase directly ──► return results
                               │         (anon-key read via RLS,
                               │          client-side filterVenues)
                               │
                               └─ no ──► Fall back to bundled mock data
                                        (in-memory venues, filtered client-side)
```

The chain is resolved once as `dataSource` in `src/lib/env.ts` (`'api' | 'supabase' | 'mock'`) and every read hook branches on that single value — `useVenues()`, `useVenue()`, `useTrending()`, and `useCities()` (see `src/api/venues.ts`, `src/api/trending.ts`, `src/api/cities.ts`). Hooks deriving their own ladder is what let `useTrending` stay two-tier and serve bundled mock venues on staging builds while Explore read live data (#150). Supabase reads apply the same `filterVenues()` predicate logic as the mock branch, ensuring filter behavior is identical across all three tiers.

Venue reads on the Supabase tier filter by `venues.city_id`, resolved from the selected `City.displayName` via `resolveCityId()` in `cities.ts` — **not** by the denormalized `venues.city` text column, which the ingest job and the client write and read in different formats (#149). Votes remain the one hook without a Supabase tier, falling back to AsyncStorage until the `cast_vote` RPC lands (#126). See [Direct Supabase Query Path](./DESIGN_DECISIONS.md#direct-supabase-query-path-from-mobile-re-added-for-live-beta) for the rationale behind re-adding the Supabase-direct tier for the v1.1.0 live beta.

### State Architecture (Current)

| State Type                  | Implementation                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| Server data (venues, votes) | TanStack Query (cached queries + mutations, live API)                |
| UI state (filters, search)  | React Context (`VenueContext`)                                        |
| Auth state (tokens, user)   | React Context (`AuthContext`) + Supabase session persistence          |
| Onboarding-completion       | AsyncStorage (`src/lib/onboarding.ts`), read outside React state       |
| Form state                  | Local component state                                                  |
| Navigation state            | expo-router                                                             |

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
│  │  ThemeProvider + AuthProvider + VenueProvider        │ │
│  │       + PortalHost + OnboardingGate                 │ │
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
│  │ TanStack Query   │  │  Supabase    │  │  Fastify   │ │
│  │ useVenues/       │─►│  Auth        │  │  API       │ │
│  │ useVoteState/    │  │  (identity)  │◄─│  (§7)      │ │
│  │ useCastVote      │  └──────────────┘  └────────────┘ │
│  │ falls back to    │                                    │
│  │ src/data/ mocks  │                                    │
│  │ when API unset   │                                    │
│  └──────────────────┘                                    │
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
        ┌──────────────────────────┐
        │     Button               │ ◄── used by VenueCard
        │     Badge                │ ◄── used by VenueCard,
        │     Ionicons, cn()       │     VenueListItem,
        │                          │     Venue Detail
        └──────────────────────────┘
```

---

## 7. Backend Architecture

`apps/api` is a Fastify server following a strict layering: **route → service → repository**. Routes handle HTTP concerns and validation (Zod, via `fastify-type-provider-zod`); services hold business logic and are unit-testable without an HTTP layer; repositories are the only code that touches storage, and exist behind a shared interface with two implementations — an in-memory one (default) and a Drizzle/Postgres one (`USE_REAL_DB=true`).

```
apps/api/src/
├── app.ts                # Registers plugins + mounts routes under /api/v1
├── routes/                # health, venues, votes, trending, auth
├── services/              # venue.service, vote.service, auth.service
├── repositories/          # {user,venue,vote}.repository (interfaces + in-memory)
│                          # drizzle-{user,venue,vote}.repository (Postgres)
├── plugins/
│   ├── cors.ts            # @fastify/cors, origins from CORS_ORIGIN
│   ├── jwt.ts              # dual-mode auth (see below)
│   └── error-handler.ts    # Zod validation errors, Fastify HTTP errors → JSON envelope
├── jobs/
│   ├── reset-votes.ts         # 04:00 America/New_York daily — clears votes, resets venue metrics
│   ├── recalculate-scores.ts  # hourly (dormant) — node-cron job now superseded by
│   │                           # pg_cron (see migration 0006)
│   └── syncVenues.ts          # Google Places ingest, run manually via npm run sync:venues
└── db/schema.ts             # Drizzle schema: cities, venues, users, votes
```

### Request Flow

```
┌──────────┐   ┌────────────┐   ┌─────────┐   ┌──────────────┐   ┌──────────┐
│  Mobile  │──►│  Fastify   │──►│ Service │──►│  Repository  │──►│ Postgres │
│  client  │   │  route +   │   │ (business│   │ (in-memory or│   │ +PostGIS │
│          │◄──│  jwt plugin│◄──│  logic) │◄──│  Drizzle)    │◄──│(Supabase)│
└──────────┘   └────────────┘   └─────────┘   └──────────────┘   └──────────┘
```

### Auth: Supabase-Only

`plugins/jwt.ts` verifies Supabase-issued tokens against Supabase's JWKS endpoint. The mobile app's `AuthProvider` handles all auth: anonymous bootstrap via `supabase.auth.signInAnonymously()`, linking via Apple/Google OAuth, and client-side token refresh via `autoRefreshToken: true`.

When a user first authenticates with Supabase, a `public.users` row is auto-provisioned by the `on_auth_user_created` trigger (see migrations wave #181). This happens at identity-creation time, regardless of whether the user ever calls an authenticated API endpoint. This is the mode the mobile app is designed against — see [`auth-flow.svg`](./auth-flow.svg).

### Scheduled Jobs

Two `node-cron` jobs run in-process (no Redis, no worker queue — see `DESIGN_DECISIONS.md` for the trade-off): a daily vote reset at 04:00 America/New_York (the nightlife-day boundary; see #64) and an hourly hotspot-score recalculation. Both are skipped when `NODE_ENV=test`.

### Deployment

`apps/api/Dockerfile` builds a multi-stage production image (`node:25-alpine`, Turborepo-aware). The chosen deploy target is Railway (see [`docs/ops/RAILWAY_SETUP.md`](../ops/RAILWAY_SETUP.md)); `docker-compose.yml` at the repo root provisions a local Postgres+PostGIS and Redis for development (Redis is provisioned but not yet used by any code path).
