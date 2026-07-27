# API Client Layer

Overview of the mobile app's TypeScript API client architecture, data flow, and environment configuration. Covers `apps/mobile/src/api/`.

---

## File Structure

```
src/api/
├── client.ts         ── Generic fetch wrapper + auth token holder (transport layer)
├── query-client.ts   ── TanStack React Query singleton configuration
├── venues.ts         ── Venue query hooks with key factory
├── trending.ts       ── Global Rankings leaderboard hook (top venues by score)
├── venueRow.ts       ── Shared public.venues column list + row→Venue mapping
├── votes.ts          ── Vote state query + cast/remove mutation hooks (optimistic)
├── cities.ts         ── City list query hook, nearest-city + city-id resolvers
└── voteStorage.ts    ── AsyncStorage persistence for mock-mode vote state
```

---

## Read Tiers

Every read hook branches on one derived value, `dataSource` from `src/lib/env.ts`:

```typescript
export const dataSource: 'api' | 'supabase' | 'mock' = hasApi ? 'api' : hasSupabase ? 'supabase' : 'mock';
```

- **`api`** — calls `apiClient()` against the Fastify API (`EXPO_PUBLIC_API_URL` set).
- **`supabase`** — reads `public.venues` / `public.cities` directly with the anon key under RLS public-read, and applies `filterVenues()` client-side. This is the tier staging/TestFlight builds run on: #128 deliberately leaves `EXPO_PUBLIC_API_URL` unset.
- **`mock`** — reads bundled fallback data (`src/data/venues.ts`) or, for votes, AsyncStorage-persisted mock state (`voteStorage.ts`).

Hooks branch on `dataSource` rather than re-deriving their own ladder from `hasApi`/`hasSupabase`. `useTrending` previously kept a two-tier ladder of its own and so served bundled mock venues on every Supabase-direct build while `useVenues` read live data (#150) — Global Rankings looked healthy while showing fabricated numbers.

Votes are the one deliberate exception: they have no Supabase tier yet and fall back to AsyncStorage until the `cast_vote` RPC lands (#126).

### Venue reads resolve a city id first

The Supabase tier filters venues on `venues.city_id`, not on the denormalized `venues.city` text column. Those two never agreed: the ingest job writes the bare name it was invoked with (`'Charlotte'`) while the client holds a `City.displayName` (`'Charlotte, NC'`), so equality on that column matched **zero rows for every city** — the entire Explore tab read empty on v1.1.0 (#149).

`resolveCityId(client, displayName)` in `cities.ts` maps the display name to its `cities.id` through the same cached query `useCities()` reads, so the lookup costs no extra round-trip after the first. It **throws** when no city matches, surfacing the caller's error state — deliberately louder than returning an empty list, which is indistinguishable from "this city has no venues" and is precisely what disguised the original bug.

```
useVenues('Charlotte, NC')
   └─► resolveCityId ──► queryClient.fetchQuery(citiesQueryOptions)   [cached 1h]
          └─► cities.find(displayName) ──► '47f7fc8a-…'
                 └─► venues.select(…).eq('city_id', '47f7fc8a-…')
```

Both venue queries order by `hotspot_score` descending with `name` as a tiebreak. The tiebreak matters today: nothing recalculates `hotspot_score` outside the unpaid Fastify API, so every live venue scores 0 and an all-ties set would otherwise come back in a different order on each refetch.

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
│  src/api/venues.ts   → useVenues(city, filters), useVenue(id)    │
│  src/api/trending.ts → useTrending(city)                         │
│  src/api/votes.ts    → useVoteState(city), useCastVote(city),    │
│                         useRemoveVote(city)                      │
│  src/api/cities.ts   → useCities(), findNearestCity(),           │
│                         resolveCityId()                          │
└──────────────────────────┬──────────────────────────────────────┘
             dataSource?   │
      ┌──────────────┬─────┴──────────────┐
      ▼ 'api'        ▼ 'supabase'          ▼ 'mock'
┌──────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│ apiClient<T>()│ │ supabase.from()  │ │  src/data/*.ts mocks  │
│ (api/client.ts)│ │ anon key + RLS   │ │  + voteStorage.ts     │
│ fetch(BASE+path)│ │ .eq('city_id',…) │ │  (AsyncStorage)       │
│ Bearer token   │ │ filterVenues()   │ └──────────────────────┘
└──────┬─────────┘ └────────┬─────────┘
       │ HTTPS              │ HTTPS
 Fastify API (apps/api)  Supabase Postgres
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

| Hook                        | Query Key                        | `api`                                          | `supabase`                                                | `mock`                                                  |
| ---------------------------- | --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `useVenues(city, filters)`  | `['venues','list',city,filters]` | `GET /venues?city=...&filters=...`               | `venues` where `city_id` = resolved id, `is_active`, then `filterVenues` | `filterVenues(mockVenuesByCity[city] ?? mockVenues, filters)` |
| `useVenue(id)`               | `['venues','detail',id]`         | `GET /venues/:id`                                 | `venues` where `id` + `is_active`, `maybeSingle()`             | Finds venue in mock array                                   |

Both hooks set `staleTime: 30_000`; `useVenue` has `enabled: !!id`. Keys stay scoped by the city **display name** even though the query filters by id — the two are 1:1, and the display name is what callers and the vote cache already hold.

### `trending.ts` — Global Rankings Leaderboard

`useTrending(city)` (key `['trending','list',city]`) returns the city's top 10 venues by `hotspot_score`. There is no separate trending table — "trending" is the top slice of the same `venues` rows, so the Supabase tier reuses `VENUE_COLUMNS` and `rowsToVenues` from `venueRow.ts` and adds `.limit(10)`. The `api` tier calls `GET /trending/:city`; the `mock` tier uses `getMockTrending(city)`.

### `venueRow.ts` — Shared Row Mapping

`VENUE_COLUMNS` (the `select()` list), the `VenueRow` interface (snake_case, with `numeric` columns arriving as strings), and `rowToVenue` / `rowsToVenues`. Extracted so the venue-list, trending, and detail queries cannot drift into separate column lists or mappings — that drift is what left Global Rankings on mock data. `rowToVenue` returns `null` for rows with unparseable coordinates and `rowsToVenues` drops them, so one bad row cannot blank the map.

### `votes.ts` — Vote State & Mutation Hooks

Query key is scoped **per city** (`voteKeys.state(city)`) so switching cities invalidates the daily vote allowance automatically.

| Hook                 | Live                                   | Mock                                                          |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `useVoteState(city)`  | `GET /votes?city=...`                       | `readPersistedVoteState(city)` (AsyncStorage), falls back to `DEFAULT_VOTE_STATE` |
| `useCastVote(city)`   | `POST /votes` (optimistic `voteCount` bump on the venue-detail cache, rolled back `onError`) | `castMockVote` — writes updated state to AsyncStorage |
| `useRemoveVote(city)` | `DELETE /votes/:venueId`                    | `removeMockVote` — writes updated state to AsyncStorage             |

Default vote state: `{ remainingVotes: 3, maxVotes: 3, votedVenueIds: [] }`.

### `cities.ts` — City List

`useCities()` returns the active `cities` rows (1-hour `staleTime`), built from the shared `citiesQueryOptions` so imperative callers hit the same cache entry. `findNearestCity(cities, location, maxMiles=50)` is a haversine-based picker used by `VenueContext` to seed `selectedCity` from the onboarding-captured `userLocation`. `resolveCityId(client, displayName)` maps a display name to its `cities.id` for venue queries (see [Venue reads resolve a city id first](#venue-reads-resolve-a-city-id-first)), throwing when no city matches.

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
