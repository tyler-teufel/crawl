# Backend Implementation Plan

A comprehensive plan for building Crawl's backend API and making the project production-ready. Each phase is independently deployable. Research areas are called out before each section so you can make informed decisions before writing code.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Phase 1 — Backend API Server](#2-phase-1--backend-api-server)
3. [Phase 2 — Database](#3-phase-2--database)
4. [Phase 3 — Authentication](#4-phase-3--authentication)
5. [Phase 4 — Wire Frontend to Live API](#5-phase-4--wire-frontend-to-live-api)
6. [Phase 5 — Venue Data Pipeline](#6-phase-5--venue-data-pipeline)
7. [Phase 6 — Real-Time Updates](#7-phase-6--real-time-updates)
8. [Phase 7 — Infrastructure & Deployment](#8-phase-7--infrastructure--deployment)
9. [Phase 8 — Observability & Reliability](#9-phase-8--observability--reliability)
10. [Phase 9 — Security Hardening](#10-phase-9--security-hardening)
11. [Phase 10 — Production Launch Checklist](#11-phase-10--production-launch-checklist)

---

## 1. Current State

The mobile app has a complete frontend shell with TanStack Query hooks (`src/api/`) that return mock data. The hooks are designed so that only the `queryFn` implementations need to change when a real API exists. The CI/CD pipeline for mobile builds is defined but not all secrets/environments are configured.

**What exists:**

- 4 complete screens + 2 placeholders
- TanStack Query data layer with mock `queryFn` (venues, votes)
- API client shell (`src/api/client.ts`) pointing at `EXPO_PUBLIC_API_URL`
- Database schema reference in `docs/DATA_PIPELINE.md`
- CI/CD workflow files for mobile builds

**What doesn't exist:**

- Backend server
- Database
- Authentication
- Real venue data
- Production hosting

---

## 2. Phase 1 — Backend API Server

### Research Before Starting

- **Framework choice**: Express vs Fastify vs Hono vs NestJS. Key considerations:
  - Express: largest ecosystem, most hiring-friendly, slower performance
  - Fastify: 2-3x faster than Express, JSON schema validation built-in, good plugin system
  - Hono: ultralight, runs on edge runtimes (Cloudflare Workers), emerging ecosystem
  - NestJS: opinionated structure (modules/controllers/services), great for large teams, heavier
- **Language**: TypeScript on Node.js (shares types with the mobile app) vs a different runtime
- **Monorepo vs separate repo**: Sharing types between frontend and backend is valuable. Research Turborepo, npm workspaces, or a `shared/` package approach. Alternatively, a separate repo with a published types package.
- **API style**: REST (current plan in DATA_PIPELINE.md) vs tRPC (end-to-end type safety with zero code generation, pairs naturally with TanStack Query). Research the tRPC + React Query integration — it could eliminate the API client layer entirely.

### Implementation Steps

1. **Initialize the backend project**
   - Choose location: `server/` directory in monorepo or separate repo
   - Set up TypeScript, ESLint, Prettier (matching frontend config where possible)
   - Set up `nodemon` or `tsx watch` for dev hot-reload

2. **Define the route structure** (from DATA_PIPELINE.md)

   ```
   GET    /api/v1/venues              List venues (city, lat, lng, radius, filters, q, page, limit)
   GET    /api/v1/venues/:id          Single venue detail
   GET    /api/v1/votes               User's vote state (requires auth)
   POST   /api/v1/votes               Cast a vote (requires auth)
   DELETE /api/v1/votes/:venueId      Remove a vote (requires auth)
   GET    /api/v1/trending/:city      Ranked venues for a city
   POST   /api/v1/auth/register       Create account
   POST   /api/v1/auth/login          Authenticate
   POST   /api/v1/auth/refresh        Refresh JWT
   ```

3. **Build request validation**
   - Research: Zod (composable, works with tRPC), Joi, AJV (Fastify-native), TypeBox
   - Define schemas for every request body and query param
   - Return structured error responses: `{ error: string, details?: object }`

4. **Implement service layer**
   - Separate route handlers from business logic (controller → service → repository pattern)
   - This keeps the code testable — services can be unit tested without HTTP

5. **Set up testing**
   - Research: Vitest (fast, ESM-native) vs Jest
   - Unit tests for service/business logic
   - Integration tests for API routes (supertest or the framework's test client)
   - Decide on test database strategy: test-specific database, transactions that rollback, or Docker containers per test run

### Key Decisions to Document

- [ ] Framework choice and why
- [ ] Monorepo vs separate repo
- [ ] REST vs tRPC
- [ ] Validation library
- [ ] Test framework and strategy

---

## 3. Phase 2 — Database

### Research Before Starting

- **PostgreSQL hosting**: Compare options based on cost, connection pooling, and managed backups:
  - Supabase (Postgres + auth + realtime built-in — could simplify Phases 2-4 significantly)
  - Neon (serverless Postgres, branching for dev/preview environments)
  - Railway (simple deploy, good DX, straightforward pricing)
  - AWS RDS / Google Cloud SQL (full control, more operational overhead)
  - PlanetScale (MySQL-based, different from the planned Postgres schema)
- **ORM vs query builder**: Research based on your comfort level:
  - Drizzle ORM: lightweight, SQL-like syntax, great TypeScript inference, runs everywhere
  - Prisma: declarative schema, auto-generated client, migration system, larger bundle
  - Kysely: type-safe query builder, no schema DSL, stays close to SQL
  - Raw `pg` + SQL: full control, no abstraction overhead, more manual work
- **PostGIS**: Needed for geo queries (venues within radius). Check if your hosting provider supports it — Supabase and Neon both include PostGIS. Research the `ST_DWithin` and `ST_Distance` functions.
- **Redis**: Needed for vote count caching, trending leaderboard (sorted sets), and later WebSocket pub/sub. Options:
  - Upstash (serverless Redis, free tier, good for edge)
  - Railway Redis
  - AWS ElastiCache
  - Decide if Redis is needed at launch or if Postgres alone handles the load

### Implementation Steps

1. **Set up the database**
   - Provision a Postgres instance on your chosen platform
   - Enable PostGIS extension
   - Configure connection pooling (PgBouncer or provider-managed)

2. **Create the schema** (reference: DATA_PIPELINE.md)

   ```sql
   -- Core tables
   venues (id, name, type, address, city, location, hotspot_score, vote_count, ...)
   users (id, email, password_hash, display_name, city, ...)
   votes (id, user_id, venue_id, voted_at, UNIQUE(user_id, venue_id, voted_at))
   ```

3. **Set up migrations**
   - Research: Drizzle Kit, Prisma Migrate, golang-migrate, or raw SQL files with a runner
   - Every schema change must be a versioned migration, never a manual ALTER
   - Seed script for development data (convert existing mock venues to seed)

4. **Implement the repository layer**
   - One repository per entity (VenueRepository, VoteRepository, UserRepository)
   - Geo queries: `SELECT * FROM venues WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, $radius)`
   - Filtering: dynamic WHERE clauses for type, open status, trending
   - Pagination: cursor-based (better performance) vs offset-based (simpler)

5. **Implement scheduled jobs**
   - Midnight CRON: reset daily votes (`DELETE FROM votes WHERE voted_at < CURRENT_DATE`)
   - Hourly CRON: recalculate hotspot scores (weighted formula combining vote count, recency, velocity)
   - Research: node-cron, BullMQ (Redis-backed job queue), or platform-native crons

### Key Decisions to Document

- [ ] Database hosting provider
- [ ] ORM/query builder choice
- [ ] Migration tooling
- [ ] Whether Redis is needed at launch
- [ ] Pagination strategy (cursor vs offset)
- [ ] Hotspot score algorithm (what inputs, what weights)

---

## 4. Phase 3 — Authentication

### Research Before Starting

- **Auth approach**: Build your own vs use a service:
  - **Build your own**: JWT access + refresh tokens, bcrypt password hashing, email verification. Full control, more code to maintain and secure.
  - **Supabase Auth**: If using Supabase for the database, auth comes free. Handles email/password, OAuth, magic links, session management. SDKs for React Native.
  - **Clerk**: Drop-in auth with React Native SDK, social login, MFA, user management UI. Paid past free tier.
  - **Firebase Auth**: Free tier is generous, good React Native support, but locks you into Firebase ecosystem.
  - **Auth.js (NextAuth)**: If backend is Node-based, handles providers and sessions. More web-focused.
- **OAuth providers**: Research which social logins matter for your audience — Apple Sign-In (required by App Store if you offer any social login), Google, potentially Instagram/TikTok for nightlife demographic.
- **Token storage on mobile**: `expo-secure-store` uses Keychain (iOS) and EncryptedSharedPreferences (Android). Research token refresh patterns — silent refresh before expiry vs refresh on 401.

### Implementation Steps

1. **User registration and login**
   - `POST /api/v1/auth/register` — validate email/password, hash with bcrypt (cost factor 12+), create user, return tokens
   - `POST /api/v1/auth/login` — verify credentials, return access token (short-lived, 15min) + refresh token (long-lived, 7 days)
   - `POST /api/v1/auth/refresh` — validate refresh token, issue new pair

2. **JWT middleware**
   - Verify access token on protected routes (votes, user profile)
   - Extract `userId` and attach to request context
   - Return 401 with structured error on invalid/expired token

3. **Mobile auth integration**
   - Install `expo-secure-store`
   - Create `src/context/AuthContext.tsx` or `src/api/auth.ts`
   - Store tokens securely, add Authorization header to `apiClient`
   - Build login/register screens under `app/(auth)/`
   - Add protected route wrapper — redirect unauthenticated users to login

4. **OAuth (if applicable)**
   - Apple Sign-In (mandatory if offering social login on iOS)
   - Google Sign-In
   - Use `expo-auth-session` or provider-specific Expo packages

### Key Decisions to Document

- [ ] Build-your-own vs auth service
- [ ] Token lifetimes (access and refresh)
- [ ] Which OAuth providers to support
- [ ] Whether email verification is required at launch

---

## 5. Phase 4 — Wire Frontend to Live API

### Research Before Starting

- **Error handling patterns**: Research how to handle API errors in TanStack Query — global error boundaries vs per-query `onError` vs `useQuery` error states. Decide on a consistent pattern.
- **Offline behavior**: Should the app work offline with stale cache? TanStack Query's `networkMode` and `gcTime` settings control this. Research `persistQueryClient` for persisting cache to AsyncStorage across app restarts.
- **Optimistic updates**: The vote mutations already have the structure for optimistic updates (from DATA_PIPELINE.md Phase C). Research the `onMutate` → `onError` rollback → `onSettled` invalidation pattern.

### Implementation Steps

1. **Update `src/api/client.ts`**
   - Add Authorization header from secure store
   - Add response interceptor for 401 → trigger token refresh → retry
   - Add request/response logging in development

2. **Swap `queryFn` implementations**
   - `useVenues`: `queryFn: () => apiClient('/venues?city=...')`
   - `useVenue`: `queryFn: () => apiClient('/venues/${id}')`
   - `useVoteState`: `queryFn: () => apiClient('/votes')`
   - `useCastVote`: `mutationFn: () => apiClient('/votes', { method: 'POST', body: ... })`
   - `useRemoveVote`: `mutationFn: () => apiClient('/votes/${venueId}', { method: 'DELETE' })`

3. **Add optimistic updates to vote mutations**
   - Implement `onMutate` for immediate UI feedback
   - Implement `onError` for cache rollback
   - Implement `onSettled` to invalidate and refetch

4. **Handle loading and error states in screens**
   - Add skeleton loaders or shimmer placeholders for venue lists
   - Add error states with retry buttons
   - Add pull-to-refresh on venue list and voting screens

5. **Remove mock data from production code paths**
   - Keep `src/data/venues.ts` for development/testing only
   - Add environment flag or remove imports from `src/api/` files

### Key Decisions to Document

- [ ] Offline support strategy
- [ ] Error display pattern (toasts, inline errors, error boundaries)
- [ ] Whether to keep mock data fallback for development

---

## 6. Phase 5 — Venue Data Pipeline

### Research Before Starting

- **Venue data sources**: Where do real venues come from?
  - Google Places API (most comprehensive, costs per request after free tier)
  - Yelp Fusion API (free tier: 5000 calls/day, good bar/nightlife data)
  - Foursquare Places API (good venue data, generous free tier)
  - Manual curation by city (highest quality, doesn't scale)
  - Research terms of service — some APIs prohibit storing data long-term
- **Geocoding**: If importing venues, you need lat/lng. Google Geocoding API or the venue API usually provides this. Decide if you need reverse geocoding (user location → city name).
- **Data freshness**: How often should venue data refresh? Hours change, venues close. Research a sync strategy.

### Implementation Steps

1. **Build venue import pipeline**
   - Script or service that fetches venues from chosen API
   - Transform external data format → Crawl's `venues` schema
   - Upsert logic (update existing venues, add new ones, flag permanently closed)

2. **Implement city onboarding**
   - Define what it means to "support" a city: minimum venue count, coverage area
   - Build an admin script or dashboard to trigger venue import for a new city
   - Populate initial hotspot scores (could default to 0 or use external ratings)

3. **Build the hotspot score algorithm**
   - Research inputs: vote count (daily), vote velocity (recent hour), historical average, external ratings
   - Define the formula and weights
   - Implement as a scheduled job that runs hourly
   - Store historical scores for trending detection (is score increasing or decreasing?)

4. **Determine what "trending" means**
   - Score velocity (rising faster than average)?
   - Top N% by vote count today?
   - Manual curation flag?
   - This directly affects the Trending filter and the voting screen ranking

### Key Decisions to Document

- [ ] Primary venue data source
- [ ] Data refresh frequency
- [ ] Hotspot score formula
- [ ] Definition of "trending"
- [ ] How to handle venue closures and data staleness

---

## 7. Phase 6 — Real-Time Updates

### Research Before Starting

- **WebSocket implementation**: Research options:
  - Socket.IO (most popular, auto-reconnection, room support, larger bundle)
  - ws (bare WebSocket, lightweight, no auto-reconnection out of box)
  - Ably / Pusher (managed WebSocket service, no server-side WS infrastructure)
  - Supabase Realtime (if using Supabase, Postgres changes stream to clients for free)
  - Server-Sent Events (simpler than WS, one-directional, sufficient for score updates)
- **Scaling WebSockets**: A single server can handle ~10K concurrent connections. Beyond that, you need Redis pub/sub or a managed service to fan out messages across multiple server instances. Research this based on expected user count.
- **Battery and data impact on mobile**: Persistent connections drain battery. Research best practices for mobile WS — reconnection backoff, background disconnect, foreground-only connections.

### Implementation Steps

1. **Server-side WebSocket endpoint**
   - `ws/live?city=austin` — clients subscribe to a city's live feed
   - Events: `vote_update { venueId, newScore, newVoteCount }`, `trending_change { rankings }`
   - Publish events when votes are cast (from the vote service)

2. **Client-side integration**
   - Create `src/api/realtime.ts` with connection management
   - Connect on app foreground, disconnect on background (use `AppState` listener)
   - On `vote_update`: update TanStack Query cache directly via `queryClient.setQueryData`
   - On `trending_change`: invalidate trending query to refetch

3. **Scaling path**
   - Start simple: single-server WebSocket
   - When needed: add Redis pub/sub so vote events published on any server reach all connected clients

### Key Decisions to Document

- [ ] WebSocket library or managed service
- [ ] Whether to implement WS at launch or defer
- [ ] Foreground-only vs background connections
- [ ] Scaling strategy

---

## 8. Phase 7 — Infrastructure & Deployment

### Research Before Starting

- **Hosting platform**: This is the biggest infrastructure decision. Compare:
  - **Railway**: Simple deploy from GitHub, auto-scaling, Postgres + Redis addons, pay-per-use. Great DX for small teams.
  - **Render**: Similar to Railway, free tier for web services, managed Postgres.
  - **Fly.io**: Deploy containers close to users, good for geo-distributed apps. More ops knowledge needed.
  - **AWS (ECS/Fargate or Lambda)**: Full control, complex setup, free tier for 12 months. Overkill unless you need specific AWS services.
  - **Vercel**: If using Next.js or serverless functions. Edge functions for API routes.
  - **Supabase**: If using Supabase for DB + auth, the "backend" is just Edge Functions (Deno) + Postgres RPC. No separate server to deploy.
- **Container vs serverless**: Containers give you persistent WebSocket connections. Serverless (Lambda, Edge Functions) is cheaper at low scale but doesn't support long-lived connections.
- **Environment management**: How many environments? Typically: `development` (local), `staging` (shared test), `production`. Each needs its own database and Redis instance.
- **Domain and SSL**: Custom domain for the API (e.g., `api.crawlapp.com`). All platforms provide free SSL via Let's Encrypt.

### Implementation Steps

1. **Set up environments**
   - Development: local Docker Compose (Postgres + Redis + API server)
   - Staging: deployed instance connected to staging database
   - Production: deployed instance with production database

2. **Containerize the backend**
   - Write `Dockerfile` with multi-stage build (build → production image)
   - `docker-compose.yml` for local development (API + Postgres + Redis)
   - `.dockerignore` for node_modules, .env, etc.

3. **Set up CI/CD for the backend**
   - GitHub Actions workflow:
     - On PR: lint, typecheck, run tests
     - On merge to main: build container, deploy to staging
     - On tag: deploy to production (with approval gate)
   - Research: GitHub Actions → Railway auto-deploy vs manual deploy scripts

4. **Configure environment variables**
   - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - Venue API keys (Google Places, Yelp, etc.)
   - `CORS_ORIGIN` (mobile app doesn't need CORS, but web client might)
   - Use platform's secret management (Railway variables, AWS Secrets Manager, etc.)

5. **Set up DNS and SSL**
   - Point `api.crawlapp.com` (or similar) to the hosting platform
   - Configure HTTPS (usually automatic)
   - Update `EXPO_PUBLIC_API_URL` in the mobile app's environment config

### Key Decisions to Document

- [ ] Hosting platform
- [ ] Container vs serverless
- [ ] Number of environments
- [ ] Domain name for the API

---

## 9. Phase 8 — Observability & Reliability

### Research Before Starting

- **Error tracking**: Sentry (industry standard, has React Native SDK + Node SDK — one service for both frontend and backend), Bugsnag, or Datadog. Research Sentry's free tier limits.
- **Logging**: Structured JSON logging (pino for Fastify, winston for Express). Ship to a centralized platform: Datadog, Logtail, AWS CloudWatch. Research what your hosting platform provides natively.
- **Uptime monitoring**: Betterstack (formerly Better Uptime), Checkly, or UptimeRobot. Ping the health endpoint and alert on failures.
- **Rate limiting**: Research rate limiting strategies — per-user (authenticated), per-IP (unauthenticated). Libraries: `rate-limiter-flexible`, Express rate-limit, or API gateway-level (Cloudflare, AWS API Gateway).

### Implementation Steps

1. **Structured logging**
   - Log every request: method, path, status, duration, user ID
   - Log errors with stack traces and request context
   - Use correlation IDs to trace a request across services

2. **Health check endpoint**
   - `GET /api/v1/health` — returns 200 if API is up, checks DB and Redis connectivity
   - Used by load balancers and uptime monitors

3. **Error tracking**
   - Install Sentry (or equivalent) on both backend and mobile app
   - Capture unhandled exceptions, rejected promises, and slow transactions
   - Set up alerts for error rate spikes

4. **Rate limiting**
   - Vote endpoint: limit to prevent abuse (e.g., 10 requests/minute per user)
   - Auth endpoints: strict limits to prevent brute force (e.g., 5 login attempts/minute per IP)
   - General API: reasonable limit per user (e.g., 100 requests/minute)

5. **Database monitoring**
   - Slow query logging (queries > 100ms)
   - Connection pool utilization
   - Disk usage alerts

### Key Decisions to Document

- [ ] Error tracking service
- [ ] Logging platform
- [ ] Rate limiting strategy and limits
- [ ] Alerting thresholds and notification channels (email, Slack, PagerDuty)

---

## 10. Phase 9 — Security Hardening

### Research Before Starting

- **OWASP Mobile Top 10 and API Top 10**: Familiarize with the most common vulnerabilities for mobile apps and APIs. Focus on: broken authentication, injection, improper asset management, security misconfiguration.
- **Certificate pinning**: Research whether to pin the API's TLS certificate in the mobile app. Prevents MITM attacks but makes certificate rotation harder. Libraries: `react-native-ssl-pinning`.
- **Input sanitization**: Research SQL injection prevention (parameterized queries — your ORM handles this), XSS prevention (shouldn't apply to a mobile API, but matters if you build a web dashboard).

### Implementation Steps

1. **API security**
   - HTTPS everywhere (no HTTP fallback)
   - Helmet.js or equivalent for security headers (if serving any web content)
   - CORS configured to allow only known origins
   - Input validation on every endpoint (from Phase 1 validation work)
   - Parameterized queries only (never string concatenation in SQL)

2. **Authentication security**
   - Bcrypt with cost factor 12+ for password hashing
   - Short-lived access tokens (15 min), longer refresh tokens (7 days)
   - Refresh token rotation (new refresh token on each refresh, old one invalidated)
   - Account lockout after repeated failed login attempts

3. **Data protection**
   - PII minimization: only collect what's necessary (email, display name)
   - Database encryption at rest (usually provided by hosting platform)
   - Audit log for sensitive actions (account deletion, password change)

4. **Mobile app security**
   - `expo-secure-store` for token storage (already planned)
   - No sensitive data in AsyncStorage (unencrypted)
   - Consider certificate pinning for production
   - App Transport Security (ATS) enforced on iOS (HTTPS only)

5. **Dependency security**
   - `npm audit` in CI pipeline
   - Dependabot for automated security patches (already configured)
   - Pin major versions, auto-merge minor/patch

---

## 11. Phase 10 — Production Launch Checklist

Everything that must be true before real users touch the app.

### Backend

- [ ] All API endpoints implemented and tested
- [ ] Database migrations run cleanly from scratch
- [ ] Seed data for launch cities loaded
- [ ] Scheduled jobs running (vote reset, score recalculation)
- [ ] Rate limiting active on all endpoints
- [ ] Health check endpoint responding
- [ ] Error tracking capturing errors
- [ ] Logging shipping to centralized platform
- [ ] Database backups configured (daily minimum)
- [ ] SSL certificate valid and auto-renewing

### Mobile App

- [ ] `EXPO_PUBLIC_API_URL` pointing to production API
- [ ] Auth flow complete (register, login, token refresh, logout)
- [ ] Error states for all API failures (network error, server error, auth error)
- [ ] Loading states for all data-fetching screens
- [ ] Map placeholder replaced with `react-native-maps` (or acceptable without)
- [ ] App icons, splash screen, and store metadata configured in `app.json`
- [ ] `ios.bundleIdentifier` and `android.package` set
- [ ] EAS Build production profile builds successfully
- [ ] Sentry (or equivalent) initialized in the mobile app
- [ ] Privacy policy and terms of service URLs configured

### Infrastructure

- [ ] Production database provisioned with backups
- [ ] Redis provisioned (if needed)
- [ ] API deployed to production environment
- [ ] Custom domain configured with SSL
- [ ] Uptime monitoring active with alerts
- [ ] CI/CD deploying backend on merge to main
- [ ] Staging environment mirroring production setup

### App Store

- [ ] Apple Developer account active ($99/year)
- [ ] Google Play Developer account active ($25 one-time)
- [ ] App Store Connect listing created (screenshots, description, keywords)
- [ ] Google Play Console listing created
- [ ] `eas.json` submit config updated with real credentials
- [ ] Privacy policy hosted at a public URL
- [ ] Age rating questionnaire completed on both stores

---

## Suggested Phase Order

```
Phase 1 (API Server) ──► Phase 2 (Database) ──► Phase 3 (Auth)
                                                      │
                                                      ▼
Phase 5 (Venue Data) ◄── Phase 4 (Wire Frontend) ◄───┘
         │
         ▼
Phase 6 (Real-Time) ──► Phase 7 (Infrastructure) ──► Phase 8 (Observability)
                                                           │
                                                           ▼
                              Phase 10 (Launch) ◄── Phase 9 (Security)
```

Phases 1-4 are sequential — each depends on the previous. Phase 5 (venue data) can begin in parallel with Phase 4 once the database exists. Phases 6-9 can be partially parallelized but are shown in recommended order. Phase 10 is the final gate.

---

## Research Summary

A consolidated list of every decision point to research before or during implementation:

| Area          | Decision                   | Options to Evaluate                                    |
| ------------- | -------------------------- | ------------------------------------------------------ |
| Framework     | API server framework       | Express, Fastify, Hono, NestJS                         |
| Architecture  | Monorepo vs separate repo  | Turborepo, npm workspaces, separate repo               |
| API style     | REST vs tRPC               | REST (current plan), tRPC (end-to-end types)           |
| Database      | Hosting provider           | Supabase, Neon, Railway, AWS RDS                       |
| Database      | ORM / query builder        | Drizzle, Prisma, Kysely, raw pg                        |
| Database      | Pagination strategy        | Cursor-based vs offset-based                           |
| Cache         | Redis provider + necessity | Upstash, Railway, defer to later                       |
| Auth          | Build vs service           | Custom JWT, Supabase Auth, Clerk, Firebase Auth        |
| Auth          | OAuth providers            | Apple (required if any social), Google                 |
| Venues        | Data source                | Google Places, Yelp Fusion, Foursquare, manual         |
| Scoring       | Hotspot algorithm          | Vote count, velocity, recency, external ratings        |
| Real-time     | WebSocket approach         | Socket.IO, ws, Supabase Realtime, SSE, managed service |
| Hosting       | Deployment platform        | Railway, Render, Fly.io, AWS, Supabase Edge Functions  |
| Hosting       | Container vs serverless    | Containers (WS support) vs serverless (cost)           |
| Observability | Error tracking             | Sentry, Bugsnag, Datadog                               |
| Observability | Logging platform           | Datadog, Logtail, CloudWatch                           |
| Testing       | Test framework             | Vitest vs Jest                                         |
| Testing       | Test database strategy     | Separate DB, transaction rollback, Docker per run      |
