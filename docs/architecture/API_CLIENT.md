# API Client Layer

Overview of the mobile app's TypeScript API client architecture, data flow, and environment configuration. Covers `apps/mobile/src/api/`.

---

## File Structure

```
src/api/
├── client.ts         ── Generic fetch wrapper + auth token holder (transport layer)
├── query-client.ts   ── TanStack React Query singleton configuration
├── venues.ts         ── Venue query hooks with key factory
├── votes.ts          ── Vote state query + cast/remove mutation hooks (optimistic)
├── cities.ts         ── City list query hook + nearest-city resolver
└── voteStorage.ts    ── AsyncStorage persistence for mock-mode vote state
```

---

## Mock vs. Live API

Every query hook checks `hasApi` (from `src/lib/env.ts`, true when `EXPO_PUBLIC_API_URL` is set) and branches between two code paths in the same `queryFn`:

- **Live** — calls `apiClient()` against the Fastify API.
- **Mock** — reads bundled fallback data (`src/data/venues.ts`) or, for votes, AsyncStorage-persisted mock state (`voteStorage.ts`).

This means the mobile app runs standalone (no backend, no Supabase) as well as fully wired — the only difference is whether `EXPO_PUBLIC_API_URL` is set. Supabase is used **only for auth/identity**, not for venue data — the client never reads Supabase tables directly for venues.

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                  │
│          Screens + Components consume VenueContext                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ reads from context
┌──────────────────────────▼──────────────────────────────────────┐
│                    VenueProvider                                  │
│              (src/context/VenueContext.tsx)                       │
│  Wires together all query hooks and exposes:                     │
│  venues, filteredVenues, voteState, castVote, removeVote,        │
│  filters, searchQuery, selectedCity                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ calls hooks from
┌──────────────────────────▼──────────────────────────────────────┐
│                  TanStack Query Hooks                             │
│  src/api/venues.ts  → useVenues(city, filters), useVenue(id)     │
│  src/api/votes.ts   → useVoteState(city), useCastVote(city),     │
│                        useRemoveVote(city)                       │
│  src/api/cities.ts  → useCities(), findNearestCity()             │
└──────────────────────────┬──────────────────────────────────────┘
                hasApi?    │
        ┌──────────────────┴───────────────────┐
        ▼ true                                  ▼ false
┌───────────────────┐                  ┌──────────────────────┐
│   apiClient<T>()   │                  │  src/data/*.ts mocks  │
│  (src/api/client.ts)│                 │  + voteStorage.ts     │
│  fetch(API_BASE+path)│                │  (AsyncStorage)       │
│  attaches Bearer token│               └──────────────────────┘
└──────────┬─────────┘
           │ HTTPS
     Fastify API (apps/api)
```

---

## File-by-File Breakdown

### `client.ts` — HTTP Transport Layer

```typescript
const API_BASE = env.apiUrl ?? 'http://localhost:3000/api/v1';

export function setAuthToken(token: string | null): void;
export async function apiClient<T>(path: string, options?: RequestInit): Promise<T>;
```

- **Base URL resolution:** Reads `EXPO_PUBLIC_API_URL` via `src/lib/env.ts`. Falls back to `http://localhost:3000/api/v1`.
- **Auth:** `setAuthToken()` stores the current Supabase access token in module state; `apiClient` attaches it as `Authorization: Bearer <token>` on every request when present. `AuthContext` calls `setAuthToken()` whenever the Supabase session changes (sign-in, refresh, sign-out).
- **Error handling:** Throws `Error('API error: <status>')` on non-2xx responses.
- Also exports thin typed wrappers `getVenues(params)` and `castVote(venueId)` used by the query hooks.

### `query-client.ts` — TanStack React Query Configuration

Singleton `QueryClient` with `staleTime: 30s`, `gcTime: 5min`, `retry: 2`, `refetchOnWindowFocus: false`.

### `venues.ts` — Venue Query Hooks

Query key factory sorts filters before keying so `['a','b']` and `['b','a']` share a cache entry:

```typescript
export const venueKeys = {
  all: ['venues'] as const,
  list: (city, filters) => ['venues', 'list', city, [...filters].sort()] as const,
  detail: (id) => ['venues', 'detail', id] as const,
};
```

| Hook                        | Query Key                        | Live                                          | Mock                                                  |
| ---------------------------- | --------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `useVenues(city, filters)`  | `['venues','list',city,filters]` | `GET /venues?city=...&filters=...`               | `filterVenues(mockVenuesByCity[city] ?? mockVenues, filters)` |
| `useVenue(id)`               | `['venues','detail',id]`         | `GET /venues/:id`                                 | Finds venue in mock array                                   |

Both hooks set `staleTime: 30_000`; `useVenue` has `enabled: !!id`.

### `votes.ts` — Vote State & Mutation Hooks

Query key is scoped **per city** (`voteKeys.state(city)`) so switching cities invalidates the daily vote allowance automatically.

| Hook                 | Live                                   | Mock                                                          |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `useVoteState(city)`  | `GET /votes?city=...`                       | `readPersistedVoteState(city)` (AsyncStorage), falls back to `DEFAULT_VOTE_STATE` |
| `useCastVote(city)`   | `POST /votes` (optimistic `voteCount` bump on the venue-detail cache, rolled back `onError`) | `castMockVote` — writes updated state to AsyncStorage |
| `useRemoveVote(city)` | `DELETE /votes/:venueId`                    | `removeMockVote` — writes updated state to AsyncStorage             |

Default vote state: `{ remainingVotes: 3, maxVotes: 3, votedVenueIds: [] }`.

### `cities.ts` — City List

`useCities()` returns the active `cities` rows (1-hour `staleTime`). `findNearestCity(cities, location, maxMiles=50)` is a haversine-based picker used by `VenueContext` to seed `selectedCity` from the onboarding-captured `userLocation`.

### `voteStorage.ts` — Mock Vote Persistence

AsyncStorage-backed persistence for mock-mode vote state, scoped by today's ISO date and city (`crawl.mockVoteState.v1`). Exists so refetches (stale-time expiry, cache GC, city switches) don't reset the daily vote count back to the default when no backend is configured. Mirrors the server-side rules in `apps/api/src/services/vote.service.ts`.

---

## How VenueContext Consumes the API Layer

`VenueProvider` in `src/context/VenueContext.tsx` composes `useVenues`, `useVoteState`, `useCastVote`, `useRemoveVote`, and `useCities`/`findNearestCity` (via `AuthContext.userLocation`), and computes `filteredVenues` by applying the client-side search-text filter on top of the server-filtered venue list. All screens and components consume this through `useVenueContext()`.

---

## Types

Defined in `src/types/venue.ts` — `Venue`, `FilterOption`, `VoteState`. See `packages/shared-types` for the Zod schemas shared with `apps/api`.

---

## Environment & URL Configuration

`EXPO_PUBLIC_API_URL` is inlined into the JS bundle at build time by Expo. Set it per build profile in `apps/mobile/eas.json` (`development`, `simulator`, `staging`, `production`) — see [`docs/ops/RAILWAY_SETUP.md`](../ops/RAILWAY_SETUP.md) for the Railway URL format, and [`docs/ops/CICD_PIPELINE.md`](../ops/CICD_PIPELINE.md) for how release workflows inject it. Leaving it unset runs the app fully in mock mode (no backend required).

Run `npm run verify:env --mode <mock|supabase|api>` in `apps/mobile` to check the current `.env` against the required key set for a given mode.

---

## Postman Collection

A Postman collection for testing all endpoints is available at the project root: `crawl-api.postman_collection.json`. Import it into Postman; environment globals live at `apps/api/postman/globals/workspace.globals.yaml`.
