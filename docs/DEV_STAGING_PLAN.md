# Dev/Staging E2E Readiness Plan

**Goal:** Get Crawl running end-to-end — mobile app → API server → Supabase database — for a real smoke test of the full flow.

**Updated state (2026-04-21):**
- Drizzle repositories implemented and wired (toggled by `USE_REAL_DB=true`)
- Supabase JWT verification wired; user upsert on every authenticated request
- Mobile TanStack Query hooks wired to real API (with mock fallback when `EXPO_PUBLIC_API_URL` not set)
- Map screen upgraded: uses `react-native-maps` when native module is available, falls back to `MapPlaceholder`
- Vote button in VenueDetail wired with optimistic update
- Cron jobs wired to Drizzle DB when `USE_REAL_DB=true`

---

## Phase 0 — Prerequisites

- [ ] **[YOUR ACTION]** Supabase project created and URL in hand (`https://xxxx.supabase.co`)
- [ ] **[YOUR ACTION]** Node 20+ installed (`node -v`)
- [ ] **[YOUR ACTION]** `npm install` run at monorepo root

---

## Phase 1 — Database & Supabase wiring

### Implemented in code ✅

| What | File |
|---|---|
| Drizzle ORM schema (venues, users, votes) | `apps/api/src/db/schema.ts` |
| DB connection via `getDb()` | `apps/api/src/db/index.ts` |
| Drizzle venue repository | `apps/api/src/repositories/drizzle-venue.repository.ts` |
| Drizzle vote repository | `apps/api/src/repositories/drizzle-vote.repository.ts` |
| Drizzle user repository | `apps/api/src/repositories/drizzle-user.repository.ts` |
| Conditional repo swap in app bootstrap | `apps/api/src/app.ts` (checks `USE_REAL_DB`) |
| Conditional repo swap in cron jobs | `apps/api/src/jobs/index.ts` (checks `USE_REAL_DB`) |
| Seed script (Charlotte NC + Patchogue/Sayville NY) | `apps/api/src/db/seed.ts` |
| `.env.example` with all required keys | `apps/api/.env.example` |

### Your actions

- [ ] **[YOUR ACTION]** Enable PostGIS: Supabase Dashboard → **Database** → **Extensions** → search "postgis" → **Enable**

- [ ] **[YOUR ACTION]** Create `apps/api/.env` (copy from `.env.example` and fill in real values):
  ```bash
  cp apps/api/.env.example apps/api/.env
  # Then edit: add SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
  # SUPABASE_JWT_SECRET, DATABASE_URL, and set USE_REAL_DB=true
  ```

- [ ] **[YOUR ACTION]** Run migrations and seed:
  ```bash
  cd apps/api
  npm run db:migrate   # creates tables in Supabase
  npm run db:seed      # inserts venue data
  ```

- [ ] **[YOUR ACTION]** Verify in Supabase **Table Editor** that `venues`, `users`, `votes` tables exist and `venues` has rows

---

## Phase 2 — Supabase JWT auth

### Implemented in code ✅

| What | File |
|---|---|
| Supabase JWT verification (`SUPABASE_JWT_SECRET`) | `apps/api/src/plugins/jwt.ts` |
| User upsert on every authenticated request (uses `sub` claim) | `apps/api/src/plugins/jwt.ts` |
| `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `USE_REAL_DB` added to config schema | `apps/api/src/config.ts` |

### Your actions

- [ ] **[YOUR ACTION]** Copy `SUPABASE_JWT_SECRET` from Supabase Dashboard → **Settings** → **API** → **JWT Secret** into `apps/api/.env`
- [ ] **[YOUR ACTION]** Confirm mobile app authenticates via Supabase Auth (not local JWT) — no login UI is built yet; use Supabase Dashboard → **Authentication** → **Users** to create a test user, then generate a token via Supabase JS SDK for manual API testing

---

## Phase 3 — API local dev sanity check

### Your actions

```bash
# Start API with real DB
cd apps/api && USE_REAL_DB=true npm run dev

# In another terminal:
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/venues
curl "http://localhost:3000/api/v1/trending/Charlotte,%20NC"
```

- [ ] **[YOUR ACTION]** Health returns `{"status":"ok"}`
- [ ] **[YOUR ACTION]** `/venues` returns real Supabase rows
- [ ] **[YOUR ACTION]** `/trending/Charlotte,%20NC` returns ranked venues

---

## Phase 4 — Mobile API wiring

### Implemented in code ✅

| What | File |
|---|---|
| `getVenues()` and `castVote()` in API client | `apps/mobile/src/api/client.ts` |
| `setAuthToken()` for attaching Bearer token | `apps/mobile/src/api/client.ts` |
| `useVenues` / `useVenue` wired to real API (fallback to mock when `EXPO_PUBLIC_API_URL` unset) | `apps/mobile/src/api/venues.ts` |
| `useCastVote` wired to `POST /votes` with optimistic vote count update | `apps/mobile/src/api/votes.ts` |
| `useVoteState` wired to `GET /votes` | `apps/mobile/src/api/votes.ts` |
| Vote button in VenueDetail wired — shows voted state, disables when no votes remain | `apps/mobile/app/venue/[id].tsx` |
| `CrawlMapView` with `react-native-maps` Markers + Callouts | `apps/mobile/components/map/CrawlMapView.tsx` |
| Map screen uses `CrawlMapView` when native module available, `MapPlaceholder` otherwise | `apps/mobile/app/(tabs)/index.tsx` |

### Your actions

- [ ] **[YOUR ACTION]** Create `apps/mobile/.env`:
  ```env
  EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
  # For physical device use your machine's LAN IP: http://192.168.x.x:3000/api/v1
  ```

- [ ] **[YOUR ACTION]** Install and link `react-native-maps` (required for real map; app falls back to placeholder if skipped):
  ```bash
  cd apps/mobile
  npx expo install react-native-maps
  npm run prebuild   # generates native iOS/Android code
  ```

- [ ] **[YOUR ACTION]** Start dev server and verify Explore tab loads venues from Supabase:
  ```bash
  turbo dev --filter=mobile
  ```

---

## Phase 5 — Railway deployment

See `docs/RAILWAY_SETUP.md` for the full step-by-step guide.

### Your actions (summary)

- [ ] **[YOUR ACTION]** Follow `docs/RAILWAY_SETUP.md` steps 1–8 to deploy API to Railway
- [ ] **[YOUR ACTION]** Smoke test: `GET https://<railway-url>/api/v1/health` → `{"status":"ok"}`
- [ ] **[YOUR ACTION]** Update `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to Railway URL

---

## Phase 6 — Full E2E Smoke Test

Run manually after Phases 1–5 complete.

### Unauthenticated flows

- [ ] Open app → Explore tab loads venue list from Supabase
- [ ] Search by name filters the list
- [ ] Tap a venue → Venue detail screen populates with real data
- [ ] Trending tab loads top venues by hotspot score

### Auth flows (requires auth UI — not yet built)

- [ ] **[YOUR ACTION]** Build minimal login screen or test auth via direct Supabase token injection

### Authenticated flows

- [ ] Vote button visible on Venue Detail
- [ ] Casting a vote optimistically increments vote count
- [ ] Voting on same venue disabled after first vote
- [ ] Remove vote re-enables button

### API-side verification

```bash
curl "https://<railway-url>/api/v1/trending/Charlotte,%20NC"
# Kill and restart — confirm data persists in Supabase
```

---

## Not Needed Yet — Defer These

| Item | Why it can wait |
|------|----------------|
| Auth UI (login/register screens) | Can test with token injected manually |
| `expo-secure-store` token persistence | Not blocking for initial E2E |
| PostGIS radius queries | City filter works without it |
| Redis caching | Not required for dev/staging |
| Rate limiting | Not blocking for personal testing |
| OAuth (Apple/Google) | Email/password or Supabase Dashboard is sufficient |
| Real-time WebSocket updates | Phase 6 feature |
| `packages/shared-types` unification | Types duplicated but functional |

---

## Environment Variable Reference

### `apps/api/.env`

```
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=http://localhost:8081

# Supabase (Settings → API)
SUPABASE_URL=https://your-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# Supabase (Settings → Database → Connection string → Transaction mode port 6543)
DATABASE_URL=postgresql://postgres.your-ref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

USE_REAL_DB=true

# Local-dev JWT fallback (only used when USE_REAL_DB=false)
JWT_SECRET=local-dev-secret-min-32-chars-long
JWT_REFRESH_SECRET=local-dev-refresh-secret-min-32-chars-long
LOG_LEVEL=info
```

### `apps/mobile/.env`

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
# Use LAN IP for physical device: http://192.168.x.x:3000/api/v1
# Use Railway URL for staging: https://<your-railway-url>/api/v1
```
