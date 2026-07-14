# Crawl

A nightlife and bar discovery app that lets users explore venues on a map, view hotspot scores, and vote daily for the hottest spots in their city. Built as a Turborepo monorepo: an Expo React Native app (`apps/mobile`) backed by a Fastify/Drizzle API (`apps/api`), with Supabase for Postgres + PostGIS + Auth.

**Status:** v1.1.0. Mobile app has onboarding (location + Apple/Google/anonymous auth via Supabase), map/voting/venue-detail screens wired to the live API. Backend has venues, votes, trending, and auth endpoints running against a real seeded database (Charlotte, NC and Patchogue/Sayville, NY).

## Monorepo Structure

```
crawl/
├── apps/
│   ├── mobile/            Expo React Native app (SDK 54, expo-router)
│   └── api/                Fastify API server (Drizzle ORM, Supabase Postgres)
├── packages/
│   ├── shared-types/       Zod schemas + types shared between mobile and API
│   └── eslint-config/       Shared ESLint config
├── docs/                    Project documentation
└── turbo.json                Turborepo pipeline config
```

See [`docs/guides/MONOREPO_GUIDE.md`](./docs/guides/MONOREPO_GUIDE.md) for day-to-day workspace commands.

## Current Features

- **Onboarding** — welcome splash, location permission, Apple/Google/anonymous sign-in via Supabase (anonymous users can later link a permanent identity)
- **Explore tab** — Map view with search, filter chips, and a horizontal venue carousel, backed by live `GET /venues`
- **Daily voting** — 3 votes per day with countdown timer to midnight reset, backed by `/votes` endpoints
- **Venue detail** — Animated hotspot score ring, highlights, vote CTA
- **Filters modal** — Transparent overlay with toggle switches, applied server-side
- **Global Rankings & Profile** — Placeholder screens

## Tech Stack

| Layer                | Technology                                                     |
| --------------------- | ---------------------------------------------------------------- |
| Mobile framework      | Expo SDK 54, React Native 0.81.5, React 19                      |
| Routing               | expo-router v6 (file-based)                                      |
| Styling               | NativeWind (Tailwind CSS for RN)                                  |
| Mobile data           | TanStack Query v5 against the live API                           |
| Auth                  | Supabase Auth (anonymous bootstrap + Apple/Google linking)        |
| API server            | Fastify 5 + `fastify-type-provider-zod`                          |
| ORM / DB              | Drizzle ORM, Postgres + PostGIS (Supabase-hosted)                 |
| Shared types          | Zod schemas in `packages/shared-types`                            |
| Monorepo tooling      | Turborepo, npm workspaces, Changesets                             |
| Error/perf monitoring | Sentry (mobile + API)                                             |
| Language              | TypeScript (strict mode)                                          |

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Run mobile + API together
turbo dev --parallel

# Or target one app
turbo dev --filter=mobile
turbo dev --filter=api

# Lint / typecheck / test everything
turbo lint
turbo typecheck
turbo test
```

### Prerequisites

- Node.js (see `.nvmrc` / `.node-version`)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- iOS Simulator (macOS) or Android Emulator, or Expo Go on a physical device
- A Supabase project (for real data/auth) — the mobile app and API both fall back to mock/in-memory data without one

### Environment Variables

Each app has its own `.env` — copy from the checked-in examples:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

- `apps/mobile/.env.example` documents `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`/`KEY`, Google Sign-In client IDs, and Sentry config.
- `apps/api/.env.example` documents `DATABASE_URL`/`DIRECT_URL` (Supabase Postgres), `USE_REAL_DB`, JWT secrets, and `GOOGLE_PLACES_API_KEY` (venue ingest).

Run `npm run verify:env` inside `apps/mobile` to check your env matrix against a given mode (`mock` / `supabase` / `api`).

## Backend API

The API is live under `apps/api` — see [`docs/architecture/API_REFERENCE.md`](./docs/architecture/API_REFERENCE.md) for the full endpoint reference (venues, votes, trending, auth) and [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md) for the backend architecture diagram.

```bash
cd apps/api
npm run dev            # hot-reload dev server
npm run db:migrate     # apply Drizzle migrations (requires DATABASE_URL)
npm run db:seed        # seed venues
npm run sync:venues    # pull venues from Google Places
npm run test
```

## Documentation

Detailed docs live in `docs/` (see [`docs/README.md`](./docs/README.md) for the full index):

- [Project Overview](./docs/architecture/PROJECT_OVERVIEW.md)
- [Architecture](./docs/architecture/ARCHITECTURE.md)
- [File Reference](./docs/architecture/FILE_REFERENCE.md)
- [Design Decisions](./docs/architecture/DESIGN_DECISIONS.md)
- [API Reference](./docs/architecture/API_REFERENCE.md)
- [Roadmap](./docs/planning/ROADMAP.md)
- [CI/CD Pipeline](./docs/ops/CICD_PIPELINE.md)
- [Contributing](./docs/guides/CONTRIBUTING.md)
