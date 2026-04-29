# Project Overview

**App:** Crawl
**Version:** 1.0.0-alpha
**Status:** Frontend shell complete — mock data, no backend integration

---

## What Is Crawl?

Crawl is a nightlife and bar discovery app that lets users explore venues on a map, view hotspot scores, and vote daily for the hottest spots in their city. It features a dark-themed, purple-accented (#7f13ec) UI designed for nightlife use.

## Current Feature Set

### Screens

| Screen              | Route             | Status                                                           |
| ------------------- | ----------------- | ---------------------------------------------------------------- |
| Explore (Map View)  | `/(tabs)/`        | Complete — map placeholder, search, filter chips, venue carousel |
| Daily Hotspot Votes | `/(tabs)/voting`  | Complete — vote counter, countdown timer, ranked venue list      |
| Global Rankings     | `/(tabs)/global`  | Placeholder                                                      |
| Profile             | `/(tabs)/profile` | Placeholder                                                      |
| Venue Detail        | `/venue/[id]`     | Complete — animated score ring, highlights, vote CTA             |
| Advanced Filters    | `/filters`        | Complete — transparent modal with toggle switches                |

### Key Features

- **Dark theme** with purple (#7f13ec) accent throughout
- **Animated map pins** with pulsing glow for trending venues (react-native-reanimated)
- **Animated hotspot score ring** using react-native-svg with stroke animation
- **Daily vote system** — 3 votes per day with countdown timer to midnight reset
- **Search & filter** — real-time text search + category toggle filters
- **Horizontal venue carousel** with snap-to-card paging
- **Transparent filter modal** overlaying the map screen
- **React Native Reusables** component library integrated for future UI components

### Mock Data

8 venues located in Austin, TX with varied types (cocktail bars, dive bars, nightclubs, beer gardens, speakeasies, sports bars, live music venues). Hotspot scores range from 71 to 94. 4 are marked as trending.

## Tech Stack

| Layer             | Technology                       | Version   |
| ----------------- | -------------------------------- | --------- |
| Framework         | Expo SDK                         | 54        |
| UI Framework      | React Native                     | 0.81.5    |
| React             | React                            | 19.1.0    |
| Routing           | expo-router (file-based)         | 6.0.21    |
| Styling           | NativeWind (Tailwind CSS for RN) | latest    |
| Component Library | React Native Reusables           | latest    |
| Animations        | react-native-reanimated          | 4.1.1     |
| SVG               | react-native-svg                 | 15.x      |
| Icons             | @expo/vector-icons (Ionicons)    | bundled   |
| Language          | TypeScript (strict mode)         | 5.9.2     |
| Linting           | ESLint + Prettier                | 9.x / 3.x |

### Supporting Libraries

| Package                    | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `class-variance-authority` | Component variant management (used by RNR)         |
| `clsx`                     | Conditional class name merging                     |
| `tailwind-merge`           | Tailwind class conflict resolution                 |
| `tailwindcss-animate`      | CSS animation utilities for Tailwind               |
| `@rn-primitives/portal`    | Portal rendering for modals/overlays (used by RNR) |
| `@sentry/react-native`     | Crash + error monitoring (free-tier configured)    |

## Quick Start

```bash
npm install          # Install dependencies
npm start            # Start Expo dev server
npm run lint         # Lint + format check
npm run format       # Auto-fix lint and formatting
```
