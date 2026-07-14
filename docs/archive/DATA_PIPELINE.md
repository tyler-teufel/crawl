# Data Pipeline & Backend Integration Guide

> **Archived 2026-07-14 — executed.** Venues are now seeded via `apps/api/src/jobs/syncVenues.ts` (Google Places sync) into a live Supabase database (Charlotte, NC and Patchogue/Sayville, NY seeded). See `docs/architecture/API_REFERENCE.md` for the live API and `docs/architecture/ARCHITECTURE.md` for current backend architecture.

Architecture for the backend services, API design, and the incremental migration path from mock data to a live backend.

---

## Backend Architecture

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

---

## API Endpoints

### Venues

| Method | Path                 | Query Params                                                             | Response                         |
| ------ | -------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| GET    | `/api/v1/venues`     | `city`, `lat`, `lng`, `radius`, `filters`, `q` (search), `page`, `limit` | Paginated venue list with scores |
| GET    | `/api/v1/venues/:id` | —                                                                        | Full venue detail                |

### Votes

| Method | Path                     | Body          | Response                                      |
| ------ | ------------------------ | ------------- | --------------------------------------------- |
| GET    | `/api/v1/votes`          | —             | `{ remainingVotes, maxVotes, votedVenueIds }` |
| POST   | `/api/v1/votes`          | `{ venueId }` | Updated vote state                            |
| DELETE | `/api/v1/votes/:venueId` | —             | Updated vote state                            |

### Trending

| Method | Path                     | Query Params | Response                   |
| ------ | ------------------------ | ------------ | -------------------------- |
| GET    | `/api/v1/trending/:city` | `limit`      | Ranked venue list for city |

### Auth

| Method | Path                    | Body                               | Response          |
| ------ | ----------------------- | ---------------------------------- | ----------------- |
| POST   | `/api/v1/auth/register` | `{ email, password, displayName }` | `{ user, token }` |
| POST   | `/api/v1/auth/login`    | `{ email, password }`              | `{ user, token }` |
| POST   | `/api/v1/auth/refresh`  | `{ refreshToken }`                 | `{ token }`       |

### WebSocket

| Path                   | Events                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `/ws/live?city=austin` | `vote_update { venueId, newScore, newVoteCount }`, `trending_change { rankings }` |

---

## Migration Phases

The migration from mock data to a live backend is designed to be incremental. Each phase is independently deployable.

### Phase A: Add API Client Layer

Install TanStack Query and create the API client without removing any mock data:

```bash
npx expo install @tanstack/react-query
```

Create `src/api/client.ts`:

```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // Auth header added later
    },
    ...options,
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

Create query hooks that initially return mock data:

```typescript
// src/api/venues.ts
import { useQuery } from '@tanstack/react-query';
import { mockVenues } from '@/data/venues';

export function useVenues(city: string, filters: string[]) {
  return useQuery({
    queryKey: ['venues', city, filters],
    queryFn: () => mockVenues, // Replace with apiClient call later
    staleTime: 30_000,
  });
}
```

### Phase B: Replace VenueContext Data with Queries

- Swap `venues` and `filteredVenues` in the context (or remove them from context entirely) with `useQuery` hooks
- Keep `voteState` in context/Zustand for optimistic UI
- Remove mock data imports from production code paths

### Phase C: Wire Up Vote Mutations

```typescript
export function useCastVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (venueId: string) =>
      apiClient('/votes', { method: 'POST', body: JSON.stringify({ venueId }) }),

    // Optimistic update
    onMutate: async (venueId) => {
      await queryClient.cancelQueries({ queryKey: ['votes'] });
      const previous = queryClient.getQueryData(['votes']);
      queryClient.setQueryData(['votes'], (old) => ({
        ...old,
        remainingVotes: old.remainingVotes - 1,
        votedVenueIds: [...old.votedVenueIds, venueId],
      }));
      return { previous };
    },

    // Rollback on error
    onError: (err, venueId, context) => {
      queryClient.setQueryData(['votes'], context.previous);
    },

    // Refetch on settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['votes'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}
```

### Phase D: Add Authentication

- Add `expo-secure-store` for token storage
- Create auth context with login/logout/register actions
- Add protected route wrapper for authenticated screens
- Create login/register screens under `app/(auth)/`

### Phase E: Real-Time Updates

- Establish WebSocket connection on app launch
- Listen for `vote_update` and `trending_change` events
- Update TanStack Query cache directly on WS messages
- The `HotspotScore` component already supports animated transitions — score changes will animate smoothly

---

## Database Schema (Reference)

### venues

```sql
CREATE TABLE venues (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  location      GEOGRAPHY(POINT, 4326),  -- PostGIS
  hotspot_score INTEGER DEFAULT 0,
  vote_count    INTEGER DEFAULT 0,
  is_open       BOOLEAN DEFAULT true,
  price_level   INTEGER CHECK (price_level BETWEEN 1 AND 4),
  hours         TEXT,
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### votes

```sql
CREATE TABLE votes (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  venue_id   UUID REFERENCES venues(id),
  voted_at   DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, venue_id, voted_at)  -- one vote per venue per day
);
```

### users

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  city          TEXT DEFAULT 'Austin, TX',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```
