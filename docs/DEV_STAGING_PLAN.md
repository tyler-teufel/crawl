# Dev/Staging E2E Readiness Plan

**Goal:** Get Crawl running end-to-end tonight — mobile app → local API server → Supabase database — so you can run a real smoke test of the full flow.

**Current state snapshot (2026-04-21):**
- API Phase 1 is complete: all 10 endpoints implemented, auth works, tests pass
- All repositories are **in-memory** — no database connection wired yet
- Mobile TanStack Query hooks exist but **return mock data** — not wired to the API
- Mobile has **no auth UI** (no login/register screens, no token storage)
- CI/CD pipelines exist but API deployment target (Railway) is a placeholder

**Two tiers of E2E testing:**
- **Partial E2E** (no auth): venue listing, trending — achievable after Phases 1–3 (~2 hrs)
- **Full E2E** (auth required): vote casting, vote state — requires Phase 4 (~4 hrs total)

---

## Phase 0 — Prerequisites (5 min)

Verify these are in hand before starting:

- [ ] Supabase project URL (looks like `https://xxxx.supabase.co`)
- [ ] Supabase DB connection string — from **Settings → Database → Connection string → URI**
  - Use the **pooler (Transaction mode)** string if the direct one has issues from a local machine
  - Format: `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
- [ ] Node 20+ installed (`node -v`)
- [ ] `npm install` run at monorepo root

---

## Phase 1 — Database & Supabase wiring (45–60 min)

**What's done:**
- ✅ Drizzle ORM installed and configured (`apps/api/drizzle.config.ts`)
- ✅ Schema defined in `apps/api/src/db/schema.ts` (venues, users, votes tables)
- ✅ Repository interfaces defined and used throughout services
- ✅ `db:generate`, `db:migrate`, `db:studio` scripts exist in `apps/api/package.json`

**What's missing:** Drizzle repo implementations, DB connection wired up, migrations run.

### 1.1 — Enable PostGIS on Supabase

PostGIS is already available on Supabase. Enable it in **Database → Extensions → postgis → Enable**.

Alternatively, run in the Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

The schema uses `geography(Point, 4326)` for the `location` column on venues. Without PostGIS the migration will fail.

### 1.2 — Create `apps/api/.env`

```bash
cp apps/api/.env.example apps/api/.env
```

Then fill in:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=http://localhost:8081

# From Supabase → Settings → Database → Connection string (URI mode)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Generate two secure random strings (e.g. openssl rand -hex 32)
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_REFRESH_SECRET=<different-strong-random-secret>

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
LOG_LEVEL=info
```

> **Do not commit `.env`** — it's already in `.gitignore`.

### 1.3 — Wire the database connection

**File: `apps/api/src/db/index.ts`** — currently exports a placeholder. Replace with a real Drizzle + postgres client:

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { config } from '../config.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

### 1.4 — Run migrations

```bash
cd apps/api
npm run db:generate   # generates SQL from schema.ts → drizzle/ folder
npm run db:migrate    # applies migrations to Supabase
```

Verify in Supabase **Table Editor** that `venues`, `users`, `votes` tables appeared.

### 1.5 — Implement Drizzle repositories

Three in-memory repository files need Drizzle equivalents. The interfaces are already in place — create these files alongside the existing in-memory ones:

**`apps/api/src/repositories/drizzle-venue.repository.ts`**
- `listVenues(filters)` → `db.select().from(venues).where(...)` with city/type/search filters; Haversine or PostGIS `ST_DWithin` for radius
- `getVenue(id)` → `db.select().from(venues).where(eq(venues.id, id))`
- `getTrending(city, limit)` → order by `hotspot_score DESC`
- `updateVoteCounts / updateHotspotScores` for cron job integration

**`apps/api/src/repositories/drizzle-user.repository.ts`**
- `create(data)` → `db.insert(users).values(...).returning()`
- `findByEmail(email)` → `db.select().from(users).where(eq(users.email, email))`
- `findById(id)` → by primary key

**`apps/api/src/repositories/drizzle-vote.repository.ts`**
- `getVoteState(userId, date)` → count today's votes, get votedVenueIds
- `castVote(userId, venueId)` → insert into votes + increment venues.vote_count atomically (transaction)
- `removeVote(userId, venueId)` → delete from votes + decrement venues.vote_count

### 1.6 — Register Drizzle repos in the app

**`apps/api/src/app.ts`** constructs the repository instances passed to services. Swap the InMemory constructors for Drizzle ones when `DATABASE_URL` is set:

```ts
const useDB = !!config.DATABASE_URL;
const venueRepo = useDB ? new DrizzleVenueRepository(db) : new InMemoryVenueRepository();
const userRepo  = useDB ? new DrizzleUserRepository(db)  : new InMemoryUserRepository();
const voteRepo  = useDB ? new DrizzleVoteRepository(db)  : new InMemoryVoteRepository();
```

This preserves the ability to run tests without a database.

### 1.7 — Seed venue data

Insert at least 10–15 real venues into Supabase so the explore screen has real content. The in-memory repository already seeds Charlotte, NC and Patchogue/Sayville, NY venues — mirror those for a consistent dev baseline. Options:

**Option A — SQL seed file** (fastest):
```sql
INSERT INTO venues (id, name, type, city, latitude_e6, longitude_e6, hotspot_score, vote_count, is_open, price_level, description)
VALUES
  (gen_random_uuid(), 'Whiskey Warehouse', 'bar', 'Charlotte, NC', 35209400, -80857100, 85, 0, true, 2, 'Massive whiskey bar in South End'),
  (gen_random_uuid(), 'The Tap Room', 'bar', 'Patchogue, NY', 40765700, -73015500, 83, 0, true, 2, 'Craft beer bar on Main Street Patchogue'),
  ...;
```

Run in the Supabase SQL editor.

**Option B — API seed route** (more durable):
Add a `POST /api/v1/__seed` route behind a `NODE_ENV !== 'production'` guard that inserts fixture venues.

---

## Phase 2 — API local dev sanity check (15 min)

With Phase 1 done, verify the API works against real Supabase data.

```bash
# From monorepo root
turbo dev --filter=api

# In another terminal — sanity checks
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/venues
curl "http://localhost:3000/api/v1/trending/Charlotte,%20NC"

# Auth flow
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'

# Should return { user, tokens } — save the accessToken for Phase 4 testing
```

**Success criteria:** Health returns `"status": "ok"` with `"database": "connected"`, venues returns real Supabase data, register returns a JWT pair.

---

## Phase 3 — Mobile API wiring (30–45 min)

**What's done:**
- ✅ `apps/mobile/src/api/client.ts` — fetch wrapper ready, reads `EXPO_PUBLIC_API_URL`
- ✅ TanStack Query set up with QueryClient
- ✅ Hook structure in place (`useVenues`, `useVoteState`, `useCastVote`, `useRemoveVote`)

**What's missing:** `queryFn` bodies still return mock data.

### 3.1 — Create `apps/mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

> For device testing (physical iOS/Android), use your machine's LAN IP instead of `localhost`:
> `EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1`

### 3.2 — Wire `useVenues`

**`apps/mobile/src/api/venues.ts`** — replace mock queryFn:

```ts
export function useVenues(city: string, filters?: VenueFilters) {
  return useQuery({
    queryKey: venueKeys.list(city, filters),
    queryFn: async () => {
      const params = new URLSearchParams({ city, ...filters });
      return apiClient.get<Venue[]>(`/venues?${params}`);
    },
  });
}
```

### 3.3 — Wire `useVotesState`

```ts
export function useVoteState() {
  return useQuery({
    queryKey: voteKeys.state(),
    queryFn: () => apiClient.get<VoteState>('/votes'),
    // Will return 401 until auth is wired — handle gracefully
  });
}
```

For Phase 3 only (before auth), you can temporarily skip vote hooks or return the default state on 401.

### 3.4 — Verify partial E2E

Start the Expo dev server:

```bash
turbo dev --filter=mobile
```

- Open the Explore tab — venue list should load from Supabase via the local API
- Open Trending — ranking should reflect seeded hotspot scores
- Filter panel should filter results (city, type)

**This is Partial E2E. If this works, you have the core data path wired end-to-end.**

---

## Phase 4 — Auth integration on mobile (45–60 min)

Required for vote casting and any authenticated flow.

**What's done:**
- ✅ API auth endpoints implemented and tested (register, login, refresh)
- ✅ JWT issued with correct expiry

**What's missing:** Token storage, auth headers, auth context, login/register screens.

### 4.1 — Install `expo-secure-store`

```bash
cd apps/mobile
npx expo install expo-secure-store
```

### 4.2 — Add auth context

Create `apps/mobile/src/context/AuthContext.tsx`:

```ts
type AuthContextValue = {
  user: User | null;
  tokens: { accessToken: string; refreshToken: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};
```

Persist tokens with `SecureStore.setItemAsync('tokens', JSON.stringify(tokens))` on login, read on mount.

### 4.3 — Add auth header to API client

Update `apps/mobile/src/api/client.ts` to read the access token from the auth context or SecureStore and attach it:

```ts
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
const stored = await SecureStore.getItemAsync('tokens');
if (stored) {
  const { accessToken } = JSON.parse(stored);
  headers['Authorization'] = `Bearer ${accessToken}`;
}
```

Add a 401 interceptor that calls `POST /auth/refresh` with the stored refresh token and retries once.

### 4.4 — Build minimal auth screens

For tonight, two screens are sufficient:

**`app/login.tsx`** — email + password fields, login button, link to register  
**`app/register.tsx`** — email + password + display name, register button

Wire to `AuthContext.login` / `AuthContext.register`. On success, navigate to `(tabs)/`.

Update `app/_layout.tsx` to check for a stored token on mount — redirect to `/login` if not present, `(tabs)/` if present.

### 4.5 — Wire vote mutations

Update `apps/mobile/src/api/votes.ts`:

```ts
export function useCastVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => apiClient.post('/votes', { venueId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voteKeys.state() }),
  });
}

export function useRemoveVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => apiClient.delete(`/votes/${venueId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: voteKeys.state() }),
  });
}
```

---

## Phase 5 — E2E Smoke Test (15 min)

Run this checklist manually to verify the full stack.

### Unauthenticated flows (no login required)

- [ ] Open app → Explore tab loads venue list from Supabase
- [ ] Search by name filters the list
- [ ] Tap a venue → Venue detail screen populates
- [ ] Trending tab loads top venues by score

### Auth flows

- [ ] Register a new user → receive access + refresh tokens, navigate to Explore
- [ ] Logout and log back in → tokens refresh correctly
- [ ] Access token expires → refresh interceptor fires, new token issued transparently

### Authenticated flows

- [ ] Voting tab shows remaining votes (3)
- [ ] Cast a vote → remaining votes decrements to 2
- [ ] Cast a second vote on a different venue → decrements to 1
- [ ] Attempt to vote on same venue → rejected (handled gracefully in UI)
- [ ] Remove a vote → remaining votes increments back

### API-side verification (curl or Postman)

```bash
# Confirm DB is persisting
curl "http://localhost:3000/api/v1/trending/Charlotte,%20NC"
# Kill API server, restart, confirm data still there
```

---

## What's Already Done — Skip These

| Item | Status |
|------|--------|
| Fastify server setup | ✅ Done |
| All 10 API endpoints | ✅ Done |
| Auth (register/login/refresh JWT) | ✅ Done |
| Protected route middleware | ✅ Done |
| Vote business logic (3/day, 1/venue) | ✅ Done |
| Drizzle schema definition | ✅ Done |
| Drizzle config + migration scripts | ✅ Done |
| Scheduled jobs (reset at midnight, score recalc) | ✅ Done |
| Vitest test suite (30 tests, all passing) | ✅ Done |
| CI/CD pipeline configuration | ✅ Done |
| Docker build for API | ✅ Done |
| Mobile TanStack Query setup | ✅ Done |
| API client shell (`src/api/client.ts`) | ✅ Done |
| EAS Build configuration | ✅ Done |

---

## Not Needed Tonight — Defer These

| Item | Why it can wait |
|------|----------------|
| PostGIS geo queries (radius search) | City filter works without it; geo queries are Phase 2+ |
| Redis caching | Not required for dev/staging; node-cron jobs run in-process |
| API deployment to Railway | Run locally against Supabase for E2E — deploy to Railway when the app is stable |
| Rate limiting | Not a blocker for personal E2E testing |
| OAuth (Apple/Google) | Email/password auth is sufficient for testing |
| Email verification | Skip for test accounts |
| Real-time WebSocket updates | Phase 6 feature |
| Real map (replace MapPlaceholder) | Map is cosmetic; venue list E2E works without it |
| `packages/shared-types` unification | Types are duplicated in mobile/API but functional |

---

## Environment Variable Checklist

### `apps/api/.env`

```
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=http://localhost:8081
DATABASE_URL=<supabase-connection-string>
JWT_SECRET=<32-char-random>
JWT_REFRESH_SECRET=<different-32-char-random>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
LOG_LEVEL=info
```

### `apps/mobile/.env`

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```
(Use LAN IP for physical device)

---

## Time Estimate

| Phase | Est. Time |
|-------|-----------|
| Phase 0: Prerequisites | 5 min |
| Phase 1: Database wiring | 45–60 min |
| Phase 2: API sanity check | 15 min |
| Phase 3: Mobile API wiring | 30–45 min |
| **→ Partial E2E (venues)** | **~2 hrs from start** |
| Phase 4: Auth on mobile | 45–60 min |
| Phase 5: Full E2E smoke test | 15 min |
| **→ Full E2E (votes)** | **~3.5–4 hrs from start** |

---

## Critical Path Summary

The single dependency chain blocking full E2E:

```
Enable PostGIS on Supabase
    → Create apps/api/.env with DATABASE_URL
        → Implement Drizzle repositories
            → Run db:generate + db:migrate
                → Seed venue data
                    → Wire mobile useVenues to real API
                        → ✅ Partial E2E (venues/trending)
                            → Add expo-secure-store + AuthContext
                                → Build login/register screens
                                    → Wire vote mutations
                                        → ✅ Full E2E (auth + votes)
```
