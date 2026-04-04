# Crawl

A nightlife and bar discovery app that lets users explore venues on a map, view hotspot scores, and vote daily for the hottest spots in their city. Built with Expo and React Native, featuring a dark-themed, purple-accented UI designed for nightlife use.

**Status:** Frontend shell complete with TanStack Query data layer (mock data) — no backend yet.

## Current Features

- **Explore tab** — Map view with search, filter chips, and a horizontal venue carousel
- **Daily voting** — 3 votes per day with countdown timer to midnight reset
- **Venue detail** — Animated hotspot score ring, highlights, vote CTA
- **Filters modal** — Transparent overlay with toggle switches
- **Global Rankings & Profile** — Placeholder screens

8 mock venues in Austin, TX are included for development.

## Tech Stack

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| Framework         | Expo SDK 54                                    |
| UI                | React Native 0.81.5, React 19                  |
| Routing           | expo-router v6 (file-based)                    |
| Styling           | NativeWind (Tailwind CSS for RN)               |
| Data              | TanStack Query v5 (mock data, API-ready hooks) |
| Animations        | react-native-reanimated                        |
| Component Library | React Native Reusables                         |
| Language          | TypeScript (strict mode)                       |

## Quick Start

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Or target a specific platform
npm run ios
npm run android
npm run web

# Lint + format check
npm run lint

# Auto-fix lint and formatting
npm run format

# TypeScript type check
npm run typecheck

# Native build prep
npm run prebuild
```

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- iOS Simulator (macOS) or Android Emulator, or Expo Go on a physical device

### Environment Variables

Create a `.env` file in the project root:

```
GOOGLE_MAPS_API_KEY_IOS=your_key_here
GOOGLE_MAPS_API_KEY_ANDROID=your_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

`EXPO_PUBLIC_API_URL` is optional — the API client defaults to `http://localhost:3000/api/v1` when unset. No backend is required to run the app; all data is currently mocked.

## Project Structure

```
app/                  Screens and navigation (expo-router file-based routing)
components/           Presentational components (ui/, map/, venue/, voting/, layout/)
src/
  api/                TanStack Query hooks and API client
  context/            React Context (filters, search, city selection)
  data/               Mock data (venues, filters)
  types/              TypeScript type definitions
  hooks/              Custom hooks
  lib/                Utilities (cn(), theme)
  constants/          App constants
docs/                 Project documentation
assets/               Static images
```

## Data Layer

The app uses TanStack Query with a query hook layer (`src/api/`) that currently returns mock data. The hooks are designed for a seamless swap to a real backend — only the `queryFn` implementations need to change.

| Hook                       | Purpose                  |
| -------------------------- | ------------------------ |
| `useVenues(city, filters)` | Venue list for a city    |
| `useVenue(id)`             | Single venue detail      |
| `useVoteState()`           | User's daily vote state  |
| `useCastVote()`            | Cast a vote (mutation)   |
| `useRemoveVote()`          | Remove a vote (mutation) |

## Roadmap

**Near term:**

- Replace map placeholder with `react-native-maps`
- Auth screens (login, register) with JWT + `expo-secure-store`
- Build backend API (Node/Express, PostgreSQL + Redis)
- Wire query hooks to live API endpoints
- Test suite (Jest + React Native Testing Library)

**Medium term:**

- Real-time vote updates via WebSocket
- Social features (friends, group crawls)
- Venue check-in with GPS verification
- Bar crawl route planning

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full roadmap.

## Documentation

Detailed docs live in the `docs/` directory:

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [File Reference](docs/FILE_REFERENCE.md)
- [Design Decisions](docs/DESIGN_DECISIONS.md)
- [Data Pipeline](docs/DATA_PIPELINE.md)
- [CI/CD Pipeline](docs/CICD_PIPELINE.md)
- [Contributing](docs/CONTRIBUTING.md)
