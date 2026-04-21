# Dev / Staging Readiness Plan

**Goal:** Full E2E dev/staging environment live tonight.  
**Supabase project:** already created. All phases assume a Supabase project with connection string in hand.

---

## Phase 1 — Supabase / Database Wiring

### 1.1 Environment setup
- [ ] Add `DATABASE_URL` to `apps/api/.env` (Supabase → Settings → Database → Connection string → URI mode)
- [ ] Add `DATABASE_URL` to Railway / staging env vars (Phase 2)
- [ ] Confirm `apps/api/src/config.ts` reads `DATABASE_URL` (currently scaffolded — verify it is not hard-coded)

### 1.2 Enable PostGIS
- [ ] In Supabase Dashboard → SQL Editor, run:
  ```sql
  create extension if not exists postgis;
  ```
- [ ] Confirm `apps/api/src/db/schema.ts` uses `geometry` / `geography` columns — if not, add PostGIS column for venue lat/lng

### 1.3 Drizzle migrations
- [ ] Confirm `apps/api/drizzle.config.ts` points `dbCredentials.connectionString` at `process.env.DATABASE_URL`
- [ ] Run `cd apps/api && npx drizzle-kit generate` — generates SQL migration files under `drizzle/`
- [ ] Run `npx drizzle-kit migrate` (or `push` for rapid dev) — applies schema to Supabase
- [ ] Verify tables appear in Supabase Dashboard → Table Editor: `users`, `venues`, `votes`

### 1.4 Replace in-memory repositories
Status: **Not started** — `apps/api/src/repositories/*.ts` currently use in-memory arrays.

- [ ] `venue.repository.ts` — replace in-memory store with Drizzle queries against `venues` table
- [ ] `vote.repository.ts` — replace with Drizzle queries against `votes` table
- [ ] `user.repository.ts` — replace with Drizzle queries against `users` table
- [ ] Update `apps/api/src/db/index.ts` — export a singleton `db` (drizzle + postgres client) using `DATABASE_URL`

### 1.5 Seed venues
- [ ] Write `apps/api/scripts/seed.ts` — insert 10–20 sample venues with real lat/lng for your test city
- [ ] Run: `npx tsx src/scripts/seed.ts` (or add `npm run seed` script to `apps/api/package.json`)

### 1.6 Row Level Security (RLS)
- [ ] Enable RLS on `votes` table (Supabase Dashboard → Table Editor → RLS toggle)
- [ ] Policy: users can only read/write their own votes
  ```sql
  create policy "own votes only" on votes
    using (user_id = auth.uid());
  ```
- [ ] `venues` table: read-only for all authenticated users
  ```sql
  create policy "read venues" on venues for select using (true);
  ```
- [ ] `users` table: users can read/update their own row only

---

## Phase 2 — API Deployment to Staging

### 2.1 Railway setup
- [ ] Create new Railway project → link to `apps/api` directory (set root directory to `apps/api`)
- [ ] Set build command: `npm run build`
- [ ] Set start command: `node dist/index.js`
- [ ] Add env vars in Railway dashboard:
  - `DATABASE_URL` — Supabase connection string
  - `JWT_SECRET` — random 64-char string
  - `JWT_REFRESH_SECRET` — separate random 64-char string
  - `CORS_ORIGIN` — `*` for now (tighten before production)
  - `PORT` — Railway injects this automatically; confirm `apps/api/src/config.ts` reads `process.env.PORT`
  - `NODE_ENV=production`

### 2.2 Health check
- [ ] `GET /api/v1/health` already scaffolded in `apps/api/src/routes/health.ts` — verify it tests DB connectivity (run a `SELECT 1` via Drizzle)
- [ ] Set Railway health check path to `/api/v1/health`

### 2.3 Smoke test after deploy
- [ ] `curl https://<railway-url>/api/v1/health` → `{ "status": "ok", "db": "ok" }`
- [ ] `curl https://<railway-url>/api/v1/venues?city=chicago` → JSON array (after seed)

---

## Phase 3 — Auth Wiring

Status: **Partially done** — `apps/api/src/plugins/jwt.ts` and `apps/api/src/routes/auth.ts` are scaffolded; `user.repository.ts` is in-memory.

### Option A: Custom JWT (matches current scaffold — recommended to keep)
- [ ] `POST /api/v1/auth/register` — hash password (bcrypt), insert row into `users` table via `user.repository.ts`, return access + refresh tokens
- [ ] `POST /api/v1/auth/login` — lookup user by email, compare hash, return tokens
- [ ] `POST /api/v1/auth/refresh` — validate refresh token, return new access token
- [ ] Confirm `apps/api/src/plugins/jwt.ts` registers `@fastify/jwt` with `JWT_SECRET` from config
- [ ] Confirm protected routes (`/votes`, `/trending`) call `request.jwtVerify()` before handler logic

### Option B: Supabase Auth (alternative — skip if using Option A)
- [ ] Install `@supabase/supabase-js` in `apps/api`
- [ ] Validate Supabase JWTs instead of custom ones — use Supabase JWT secret from Dashboard → Settings → API
- [ ] Remove custom register/login routes; use Supabase client in mobile app directly

> **Recommendation:** Keep Option A (custom JWT) for now — it's already scaffolded and avoids a client-side SDK dependency. Wire Supabase Auth in a later phase if needed.

### 3.1 Test auth flow
- [ ] Register a test user via curl/Insomnia
- [ ] Login and capture access token
- [ ] Hit a protected endpoint with `Authorization: Bearer <token>` — expect 200
- [ ] Hit without token — expect 401

---

## Phase 4 — Cron Jobs Live

Status: **Scaffolded but untested against real DB** — `apps/api/src/jobs/reset-votes.ts` and `recalculate-scores.ts` exist.

- [ ] Confirm `apps/api/src/jobs/index.ts` schedules both jobs (likely using `node-cron` or similar — check imports)
- [ ] `reset-votes.ts` — replace any in-memory logic with a Drizzle `DELETE FROM votes WHERE ...` scoped to the reset window
- [ ] `recalculate-scores.ts` — replace in-memory aggregation with a Drizzle query that counts votes per venue and writes a `hotspot_score` (or equivalent) column back to `venues`
- [ ] Deploy to Railway — jobs run in the same process as the API server (acceptable for staging)
- [ ] Verify in Railway logs: cron lines appear at expected intervals
- [ ] Manual trigger test: call a `POST /api/v1/admin/reset-votes` debug route (add temporarily, remove before prod) and confirm `votes` table is cleared in Supabase

---

## Phase 5 — Frontend / React Native Integration

Status: **Not started** — `apps/mobile/src/api/client.ts` reads `EXPO_PUBLIC_API_URL` but all query hooks return mock data.

### 5.1 Point mobile at staging API
- [ ] Create `apps/mobile/.env` (gitignored):
  ```
  EXPO_PUBLIC_API_URL=https://<railway-url>
  ```
- [ ] Confirm `apps/mobile/src/api/client.ts` uses `process.env.EXPO_PUBLIC_API_URL` (not a hardcoded localhost)

### 5.2 Wire real API calls into TanStack Query hooks
- [ ] `useVenues` (`src/api/venues.ts` or similar) — replace mock `queryFn` with `GET /api/v1/venues`
- [ ] `useVoteState` — replace mock with `GET /api/v1/votes`
- [ ] `useCastVote` — replace mock mutation with `POST /api/v1/votes`
- [ ] Auth hooks — call `POST /api/v1/auth/register` and `POST /api/v1/auth/login`, store tokens in SecureStore

### 5.3 Token storage + refresh
- [ ] Install `expo-secure-store` if not present
- [ ] Persist access + refresh tokens in SecureStore after login
- [ ] Add Axios/fetch interceptor (or TanStack Query `onError`) to call `/auth/refresh` on 401 and retry

### 5.4 Verify in Expo Go / dev build
- [ ] Run `turbo dev --filter=mobile` pointing at staging
- [ ] Confirm venue list loads from real DB (not mock data)
- [ ] Confirm auth tokens are stored and sent on protected calls

---

## Phase 6 — E2E Smoke Test Checklist

Run this top-to-bottom to confirm staging is fully wired:

| # | Step | Expected result | Status |
|---|------|-----------------|--------|
| 1 | `GET /api/v1/health` | `{ "status": "ok", "db": "ok" }` | ☐ |
| 2 | `POST /api/v1/auth/register` with email + password | 201 + access/refresh tokens | ☐ |
| 3 | `POST /api/v1/auth/login` with same credentials | 200 + tokens | ☐ |
| 4 | `GET /api/v1/venues?city=<city>` (no auth) | Array of venues from DB | ☐ |
| 5 | `GET /api/v1/venues/:id` | Single venue object | ☐ |
| 6 | `GET /api/v1/votes` with Bearer token | Empty array (no votes yet) | ☐ |
| 7 | `POST /api/v1/votes` with `{ venueId }` + Bearer token | 201 vote created | ☐ |
| 8 | `GET /api/v1/votes` after casting | Array with the new vote | ☐ |
| 9 | `GET /api/v1/trending/:city` | Ranked venue list with hotspot scores | ☐ |
| 10 | `DELETE /api/v1/votes/:venueId` | 204 vote removed | ☐ |
| 11 | Mobile: open app → venue list loads from staging | Real venue names visible | ☐ |
| 12 | Mobile: sign up → log in → cast vote → trending updates | Full flow without errors | ☐ |

---

## Quick Reference: Key Files

| Concern | File |
|---------|------|
| DB client | `apps/api/src/db/index.ts` |
| Drizzle schema | `apps/api/src/db/schema.ts` |
| Drizzle config | `apps/api/drizzle.config.ts` |
| Repositories | `apps/api/src/repositories/*.ts` |
| Cron jobs | `apps/api/src/jobs/index.ts` |
| JWT plugin | `apps/api/src/plugins/jwt.ts` |
| Auth routes | `apps/api/src/routes/auth.ts` |
| Health route | `apps/api/src/routes/health.ts` |
| Mobile API client | `apps/mobile/src/api/client.ts` (or `src/api/`) |
| Mobile env | `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`) |

## Quick Reference: Env Vars

| Key | Where set | Notes |
|-----|-----------|-------|
| `DATABASE_URL` | `apps/api/.env`, Railway | Supabase URI connection string |
| `JWT_SECRET` | `apps/api/.env`, Railway | 64+ random chars |
| `JWT_REFRESH_SECRET` | `apps/api/.env`, Railway | separate from access secret |
| `CORS_ORIGIN` | Railway | `*` for staging |
| `PORT` | Railway auto-injects | confirm config reads it |
| `EXPO_PUBLIC_API_URL` | `apps/mobile/.env` | Railway deploy URL |
