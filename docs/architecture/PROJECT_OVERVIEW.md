# Project Overview

**App:** Crawl
**Version:** 1.1.0
**Status:** Monorepo with a live backend — mobile app talks to a running Fastify API backed by a seeded Supabase Postgres database. Onboarding + auth are implemented; Global Rankings and Profile remain placeholders.

---

## What Is Crawl?

Crawl is a nightlife and bar discovery app that lets users explore venues on a map, view hotspot scores, and vote daily for the hottest spots in their city. It features a dark-themed, purple-accented UI designed for nightlife use, and ships a v2 brand system (custom fonts, logo lockups — see `docs/design/`).

## Current Feature Set

### Screens

| Screen               | Route                | Status                                                              |
| --------------------- | --------------------- | ---------------------------------------------------------------------- |
| Onboarding            | `/(onboarding)/*`     | Complete — welcome splash, location prompt, Apple/Google/anonymous auth |
| Explore (Map View)    | `/(tabs)/`             | Complete — live map, search, filter chips, venue carousel, backed by `GET /venues` |
| Daily Hotspot Votes   | `/(tabs)/voting`       | Complete — vote counter, countdown timer, ranked venue list, backed by `/votes` |
| Global Rankings       | `/(tabs)/global`       | Placeholder                                                            |
| Profile               | `/(tabs)/profile`      | Placeholder                                                            |
| Venue Detail          | `/venue/[id]`          | Complete — animated score ring, highlights, vote CTA                   |
| Advanced Filters      | `/filters`             | Complete — transparent modal, filters applied server-side              |

### Key Features

- **Onboarding & auth** — first-launch welcome, location permission, and Apple/Google/anonymous sign-in via Supabase Auth; anonymous users can later link a permanent identity without losing data
- **Dark theme** with purple accent throughout, v2 brand fonts (Clash Grotesk, Satoshi) and logo assets
- **Animated map pins** with pulsing glow for trending venues (react-native-reanimated), backed by `react-native-maps`
- **Animated hotspot score ring** using react-native-svg with stroke animation
- **Daily vote system** — 3 votes per day with countdown timer to midnight reset, enforced server-side (one vote per venue per day)
- **Search & filter** — real-time client-side text search + server-applied category filters
- **Horizontal venue carousel** with snap-to-card paging
- **Transparent filter modal** overlaying the map screen
- **Offline handling** — `OfflineBanner` driven by `@react-native-community/netinfo`
- **Crash/error monitoring** — Sentry wired on both mobile and API
- **React Native Reusables** component library integrated

### Live Data

Venues are seeded from Google Places into Supabase Postgres+PostGIS for two cities: Charlotte, NC and Patchogue/Sayville, NY. Both apps fall back to mock/in-memory data when no backend is configured (`EXPO_PUBLIC_API_URL` unset on mobile, `USE_REAL_DB` unset on the API).

## Backend (apps/api)

A Fastify API server backed by Drizzle ORM and Postgres+PostGIS (Supabase-hosted) serves venues, votes, trending rankings, and auth. See [API Reference](./API_REFERENCE.md) for the full endpoint list and [Architecture](./ARCHITECTURE.md#7-backend-architecture) for the service/repository layering.

## Tech Stack

| Layer              | Technology                       | Version   |
| -------------------- | ----------------------------------- | ----------- |
| Mobile framework    | Expo SDK                          | 54        |
| UI Framework        | React Native                      | 0.81.5    |
| React               | React                             | 19.1.0    |
| Routing             | expo-router (file-based)          | 6.x       |
| Styling             | NativeWind (Tailwind CSS for RN)  | latest    |
| Component Library   | React Native Reusables            | latest    |
| Mobile data         | TanStack Query                    | 5.x       |
| Mobile auth         | Supabase Auth (`@supabase/supabase-js`) | 2.x |
| Animations          | react-native-reanimated           | 4.1.1     |
| SVG                 | react-native-svg                  | 15.x      |
| Maps                | react-native-maps                 | latest    |
| Icons               | @expo/vector-icons (Ionicons)     | bundled   |
| Error monitoring    | @sentry/react-native / Sentry (API) | 7.x / — |
| API framework       | Fastify + fastify-type-provider-zod | 5.x     |
| ORM                 | Drizzle ORM                       | latest    |
| Database            | Postgres + PostGIS (Supabase)     | —         |
| Shared validation   | Zod (`packages/shared-types`)     | latest    |
| Monorepo tooling    | Turborepo, npm workspaces, Changesets | —     |
| Language            | TypeScript (strict mode)          | 5.9.x     |
| Linting             | ESLint + Prettier                 | 9.x / 3.x |

### Supporting Libraries

| Package                       | Purpose                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| `class-variance-authority`     | Component variant management (used by RNR)                     |
| `clsx`                         | Conditional class name merging                                 |
| `tailwind-merge`                | Tailwind class conflict resolution                              |
| `tailwindcss-animate`           | CSS animation utilities for Tailwind                             |
| `@rn-primitives/portal`         | Portal rendering for modals/overlays (used by RNR)               |
| `@react-native-google-signin/google-signin` | Google Sign-In for onboarding auth                 |
| `expo-apple-authentication`     | Apple Sign-In for onboarding auth                                |
| `expo-location`                 | Foreground location permission for onboarding                    |
| `@react-native-async-storage/async-storage` | Onboarding-completion flag, vote persistence        |
| `@react-native-community/netinfo` | Drives `OfflineBanner`                                        |
| `expo-updates`                  | OTA updates                                                       |
| `expo-font`                     | Loads Clash Grotesk + Satoshi custom fonts                       |
| `expo-splash-screen`            | Holds splash screen until fonts finish loading                   |
| `node-cron` (API)               | In-process scheduled jobs (vote reset, score recalculation)      |
| `bcryptjs` (API)                | Password hashing for local-dev JWT auth                          |
| `get-jwks` (API)                | JWKS verification for Supabase-issued tokens                     |

## Quick Start

```bash
npm install               # Install all workspace dependencies
turbo dev --parallel      # Run mobile + API together
turbo lint                # Lint all workspaces
turbo typecheck            # Type-check all workspaces
turbo test                 # Run tests across all workspaces
```

See the root [`README.md`](../../README.md) for per-app commands and environment setup.
