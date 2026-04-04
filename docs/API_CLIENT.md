# API Client Layer

Complete overview of the TypeScript API client architecture, data flow, and environment configuration.

---

## File Structure

```
src/api/
├── client.ts         ── Generic fetch wrapper (transport layer)
├── query-client.ts   ── TanStack React Query singleton configuration
├── venues.ts         ── Venue query hooks with key factory
└── votes.ts          ── Vote state query + cast/remove mutation hooks
```

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                  │
│          Screens + Components consume VenueContext                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ reads from context
┌──────────────────────────▼──────────────────────────────────────┐
│                    VenueProvider                                  │
│              (src/context/VenueContext.tsx)                       │
│                                                                  │
│  Wires together all query hooks and exposes:                     │
│  venues, filteredVenues, voteState, castVote, removeVote,        │
│  filters, searchQuery, selectedCity                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ calls hooks from
┌──────────────────────────▼──────────────────────────────────────┐
│                  TanStack Query Hooks                             │
│                                                                  │
│  src/api/venues.ts                                               │
│  ├── useVenues(city, filters)  ──► queryKey: ['venues','list',…] │
│  └── useVenue(id)              ──► queryKey: ['venues','detail',…]│
│                                                                  │
│  src/api/votes.ts                                                │
│  ├── useVoteState()            ──► queryKey: ['votes','state']   │
│  ├── useCastVote()             ──► mutation → cache update       │
│  └── useRemoveVote()           ──► mutation → cache update       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP via
┌──────────────────────────▼──────────────────────────────────────┐
│                    apiClient<T>()                                 │
│               (src/api/client.ts)                                │
│                                                                  │
│  fetch( EXPO_PUBLIC_API_URL + path, { json headers, ...opts } )  │
│  Throws on non-2xx  │  Returns parsed JSON as T                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                      HTTPS / WSS
                           │
                    Backend API Gateway
```

---

## File-by-File Breakdown

### `client.ts` — HTTP Transport Layer

```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T>
```

- **Base URL resolution:** Reads `EXPO_PUBLIC_API_URL` from environment. Falls back to `http://localhost:3000/api/v1` during local development.
- **Generic typed responses:** Callers specify `<T>` to get typed return values.
- **Default headers:** Sets `Content-Type: application/json`. Callers can override via `options`.
- **Error handling:** Throws a generic `Error` with the HTTP status code on non-2xx responses.
- **Auth header:** Not yet implemented — will be added in Phase D when authentication is wired up.

### `query-client.ts` — TanStack React Query Configuration

```typescript
export const queryClient = new QueryClient({ defaultOptions: { queries: { ... } } });
```

Singleton `QueryClient` with these defaults:

| Option | Value | Purpose |
|--------|-------|---------|
| `staleTime` | 30 seconds | Data considered fresh; no refetch within this window |
| `gcTime` | 5 minutes | Unused cache entries garbage-collected after this |
| `retry` | 2 | Automatic retries on query failure |
| `refetchOnWindowFocus` | false | Disabled — not useful on mobile |

### `venues.ts` — Venue Query Hooks

Uses a **query key factory** pattern for consistent cache management:

```typescript
export const venueKeys = {
  all:    ['venues'] as const,
  list:   (city, filters) => ['venues', 'list', city, filters] as const,
  detail: (id) =>            ['venues', 'detail', id] as const,
};
```

| Hook | Query Key | Current Behavior | Future Behavior (Phase B) |
|------|-----------|-----------------|---------------------------|
| `useVenues(city, filters)` | `['venues','list',city,filters]` | Returns `mockVenues` directly | `apiClient('/venues?city=...&filters=...')` |
| `useVenue(id)` | `['venues','detail',id]` | Finds venue in mock array | `apiClient('/venues/${id}')` |

Both hooks set `staleTime: 30_000` (30 seconds). `useVenue` has `enabled: !!id` to prevent queries with empty IDs.

### `votes.ts` — Vote State & Mutation Hooks

| Hook | Type | Query Key | Current Behavior | Future Behavior |
|------|------|-----------|-----------------|-----------------|
| `useVoteState()` | Query | `['votes','state']` | Returns hardcoded default (3 votes, empty array) | `GET /api/v1/votes` |
| `useCastVote()` | Mutation | N/A | Reads cache, decrements `remainingVotes`, appends venue ID | `POST /api/v1/votes` with optimistic update |
| `useRemoveVote()` | Mutation | N/A | Reads cache, increments `remainingVotes`, removes venue ID | `DELETE /api/v1/votes/:venueId` with optimistic update |

Default vote state:
```typescript
{ remainingVotes: 3, maxVotes: 3, votedVenueIds: [] }
```

Both mutations operate directly on the TanStack Query cache via `queryClient.getQueryData` / `setQueryData`. Guard checks prevent double-voting or removing a vote that doesn't exist.

---

## How VenueContext Consumes the API Layer

`VenueProvider` in `src/context/VenueContext.tsx` is the single integration point:

```
VenueProvider
│
├── useVenues(selectedCity, activeFilterIds)
│   └── destructures → { data: venues = [] }
│
├── useVoteState()
│   └── destructures → { data: voteState = DEFAULT_VOTE_STATE }
│
├── useCastVote()
│   └── exposes → castVoteMutation.mutate(venueId)
│
└── useRemoveVote()
    └── exposes → removeVoteMutation.mutate(venueId)
```

The provider also computes `filteredVenues` by applying search query and active filter IDs against the venue list. All screens and components access this via the `useVenueContext()` hook.

---

## Types

Defined in `src/types/venue.ts`:

```typescript
interface Venue {
  id: string;
  name: string;
  type: string;
  address: string;
  distance: string;
  hotspotScore: number;
  voteCount: number;
  isOpen: boolean;
  isTrending: boolean;
  highlights: string[];
  latitude: number;
  longitude: number;
  imageUrl?: string;
  priceLevel: number;    // 1-4
  hours: string;
  description: string;
}

interface VoteState {
  remainingVotes: number;
  maxVotes: number;
  votedVenueIds: string[];
}
```

---

## API Endpoints (Planned)

These endpoints are defined in `docs/DATA_PIPELINE.md` and will be consumed by the hooks once the backend is live:

### Venues

| Method | Path | Query Params | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/venues` | `city`, `lat`, `lng`, `radius`, `filters`, `q`, `page`, `limit` | Paginated venue list with scores |
| GET | `/api/v1/venues/:id` | — | Full venue detail |

### Votes

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/v1/votes` | — | `{ remainingVotes, maxVotes, votedVenueIds }` |
| POST | `/api/v1/votes` | `{ venueId }` | Updated vote state |
| DELETE | `/api/v1/votes/:venueId` | — | Updated vote state |

### Trending

| Method | Path | Query Params | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/trending/:city` | `limit` | Ranked venue list for city |

### Auth (Phase D)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/auth/register` | `{ email, password, displayName }` | `{ user, token }` |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ user, token }` |
| POST | `/api/v1/auth/refresh` | `{ refreshToken }` | `{ token }` |

### WebSocket (Phase E)

| Path | Events |
|------|--------|
| `/ws/live?city=austin` | `vote_update { venueId, newScore, newVoteCount }`, `trending_change { rankings }` |

---

## Environment & URL Configuration

### How `EXPO_PUBLIC_API_URL` Works

Expo's build system inlines any environment variable prefixed with `EXPO_PUBLIC_` into the JavaScript bundle at build time. This means:

1. **Local development:** The variable is unset, so `apiClient` uses the fallback `http://localhost:3000/api/v1`.
2. **CI/CD builds:** The variable must be set before `eas build` or `eas update` runs.

### Setting the URL for Builds

There are two approaches for injecting the URL in CI/CD:

**Option A — `eas.json` env block (recommended):**

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging-api.crawl.app/api/v1"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.crawl.app/api/v1"
      }
    }
  }
}
```

This keeps the URL tied to the build profile. Preview builds hit staging; production builds hit prod.

**Option B — GitHub Actions environment variable:**

Store the URL as a GitHub secret (`EXPO_PUBLIC_API_URL`) in Settings → Secrets and variables → Actions, then inject it in the workflow:

```yaml
- name: Build preview
  env:
    EXPO_PUBLIC_API_URL: ${{ secrets.EXPO_PUBLIC_API_URL }}
  run: eas build --platform all --profile preview --non-interactive
```

### Current State of CI/CD Workflows

| Workflow | Trigger | Relevant Secrets |
|----------|---------|-----------------|
| `preview-build.yml` | Push to `main` | `EXPO_TOKEN` |
| `release.yml` | Push tag `v*` | `EXPO_TOKEN` |
| `ota-update.yml` | Manual dispatch | `EXPO_TOKEN` |

None of these currently inject `EXPO_PUBLIC_API_URL`. This will need to be added when the backend goes live.

---

## Migration Status

The API layer is in **Phase A** (client layer exists, hooks return mock data):

| Phase | Description | Status |
|-------|-------------|--------|
| **A** | Add API client layer + TanStack Query hooks returning mock data | Done |
| **B** | Replace mock data with real `apiClient` calls in venue hooks | Not started |
| **C** | Wire up vote mutations with optimistic updates via `apiClient` | Not started |
| **D** | Add authentication (JWT, secure storage, auth screens) | Not started |
| **E** | WebSocket for real-time score and trending updates | Not started |

---

## Postman Collection

A Postman collection for testing all endpoints is available at the project root:

```
crawl-api.postman_collection.json
```

Import it into Postman via File → Import. Collection variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `baseUrl` | `http://localhost:3000/api/v1` | API base URL |
| `authToken` | (empty) | Auto-populated by Login/Register requests |
| `venueId` | `venue-001` | Reusable venue ID for testing |
| `city` | `Austin, TX` | Default city for queries |
