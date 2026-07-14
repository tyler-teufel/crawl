# Live Data Migration & Multi-City Population Plan

**Goal:** Move Crawl off bundled mock data and onto live, real-world venue data
for **several cities**, with data gathering/formatting/storage automated on a
cloud resource, so the backend is in a clean, refined state ready for **heavy
end-to-end testing**.

**Author's framing (from the request):**

1. Go back to live data (the app is currently on mock).
2. Populate **multiple cities**, not just one.
3. Explore a **Lambda / cloud resource** for gathering + formatting + storing
   the data.
4. Get the backend **cleaned up and refined** and **ready for heavy testing**.

This plan is deliberately scoped so that "testable with live data" does not
require standing up expensive always-on infrastructure. It reuses the pipeline
that already exists and adds automation and cleanup on top.

---

## 1. Current State (verified against the code, 2026-07)

The backend and the venue pipeline are far more complete than a first read of
`BACKEND_IMPLEMENTATION_PLAN.md` suggests. Here is what actually exists today.

### What's built

| Area | Status | Where |
| --- | --- | --- |
| Fastify API (venues, votes, trending, auth, health) | ✅ built | `apps/api/src/routes/*` |
| Controller → Service → Repository layering | ✅ built | `services/*`, `repositories/*` |
| Drizzle schema: `cities`, `venues`, `users`, `votes` | ✅ built | `apps/api/src/db/schema.ts` |
| In-memory **and** Drizzle repos, toggled by `USE_REAL_DB` | ✅ built | `repositories/*`, `app.ts`, `jobs/index.ts` |
| Supabase JWT verification + user upsert | ✅ built | `plugins/jwt.ts`, `config.ts` |
| Cron: daily vote reset, hourly score recalculation | ✅ built | `jobs/index.ts` |
| **Google Places (New) venue sync** — geocode → search → filter → transform → upsert | ✅ built | `jobs/syncVenues.ts`, `jobs/places/*` |
| Sync CLI (`npm run sync:venues -- --city X --state Y`) | ✅ built | `jobs/syncVenues.cli.ts` |
| Per-city registry (`cities` table, auto-upserted by sync) | ✅ built | `syncVenues.ts` `ensureCity()` |
| Mobile query hooks with live/mock branch on `EXPO_PUBLIC_API_URL` | ✅ built | `apps/mobile/src/api/{venues,votes}.ts` |

### What the app is doing right now

The mobile app runs in **Mode A (mock)**. `EXPO_PUBLIC_API_URL` is unset, so
`hasApi` is `false` and every data hook falls back to bundled data:

```
apps/mobile/src/api/venues.ts   → mockVenuesByCity / mockVenues
apps/mobile/src/api/cities.ts   → mockCities         (no /cities route exists)
apps/mobile/src/api/votes.ts    → AsyncStorage-persisted mock vote state
```

Supabase is wired for **auth only** — `venues.ts` explicitly does *not* read
Supabase venue tables directly. Live venue data therefore requires the Fastify
API to be reachable (Mode C), **or** a new Supabase-direct read path to be built
(see Decision D1).

### Data-shape / pipeline gaps (verified)

These are the concrete "cleanup and refinement" items, not hypotheticals:

| Gap | Evidence | Impact on live data |
| --- | --- | --- |
| Sync is **manual + single-city** | `syncVenues.cli.ts` takes one `--city/--state`; not in `jobs/index.ts` | No automated multi-city population |
| `--dry-run` **still writes** | `syncVenues.cli.ts` comment: "advisory only; fall through to the normal path" | Can't safely preview a sync |
| `imageUrl` **never populated** | `transform.ts` omits it; photos are fetched in the field mask but never resolved via `buildPhotoUrl` | Venue cards/detail have no images |
| `description` **never populated** | `transform.ts` omits it; schema defaults to `''` | Empty descriptions in UI |
| `highlights` **never populated** | `transform.ts` omits it; schema defaults to `'{}'` | Empty highlight chips |
| `isOpen` **never maintained** | schema TODO comment; sync doesn't set it; defaults `true` | "Open now" is always true |
| No `/api/v1/cities` route | `routes/` has none; `useCities` returns mock | City picker can't go live |
| `city` denormalized on `venues` | schema TODO: will drift from `cities.name` | Minor; acceptable near-term |

### The three delivery modes (from the stabilization plan)

- **Mode A — Mock:** zero hosting, bundled data. *(current)*
- **Mode B — Supabase-direct:** app reads venues straight from Supabase
  (PostgREST + RLS). **Not implemented** — the client only uses Supabase for auth.
- **Mode C — Full API (Railway/host):** the Fastify API serves live data from
  Supabase Postgres.

> **Host status (2026-07):** the Railway deployment of the API is **currently
> paused** — the free trial ended and the paid subscription was not activated. So
> Mode C has no live host right now. This does **not** block populating data (the
> sync writes straight to Supabase; see the note below), but it does mean the
> app's live read path needs a host decision before heavy testing. See
> **Decision D1** for the host options and recommendation.

> **Data population is host-independent.** The sync (`syncCity()`) writes directly
> to Supabase Postgres via `DATABASE_URL` — it never calls the Fastify API. Multi-
> city live data can be gathered and stored **regardless of Railway's status**, so
> Phases 1–3 can proceed while the host question is still open.

---

## 2. Target Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                         DATA GATHERING (new automation)         │
│                                                                 │
│   City list (config)         Google Places API (New)            │
│   austin, charlotte, ...  ──► + Geocoding                        │
│         │                        │                              │
│         ▼                        ▼                              │
│   ┌──────────────────────────────────────────┐                 │
│   │  syncCity() pipeline  (already built)      │                 │
│   │  geocode → searchText → filter → transform │                 │
│   │  → upsert venues + ensure city row         │                 │
│   └───────────────────┬────────────────────────┘                 │
│   runs on: GitHub Actions cron (now) → Lambda/Railway (later)   │
└───────────────────────┼────────────────────────────────────────┘
                        │ writes (idempotent upsert by google_place_id)
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    Supabase Postgres (+ PostGIS)                │
│   cities · venues · users · votes                              │
└───────────────────────┬────────────────────────────────────────┘
                        │ reads/writes
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     Fastify API (apps/api)                     │
│   /venues /venues/:id /votes /trending/:city /auth /health     │
│   + NEW: /cities                                                │
│   cron: vote reset · score recalc                              │
└───────────────────────┬────────────────────────────────────────┘
                        │ HTTPS  (EXPO_PUBLIC_API_URL)
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    Mobile app (TanStack Query)                 │
│   useVenues · useCities · useVoteState · useCastVote           │
└───────────────────────────────────────────────────────────────┘
```

**Design principle:** the data-gathering job is decoupled from the API. It is a
batch process that writes to the same Postgres the API reads. That means we can
run it anywhere (CI, Lambda, a container) without touching the request path, and
we can populate the database with live data for many cities **before** the API is
even deployed — enabling heavy testing against a realistic dataset.

---

## 3. Cloud Resource for Data Gathering — Recommendation

The user is open to a Lambda "or other cloud resource." The gathering + formatting
+ storage logic **already exists** (`syncCity()`); the only open question is
*where it runs on a schedule across multiple cities*.

| Option | Fit | Cost | Effort | Notes |
| --- | --- | --- | --- | --- |
| **GitHub Actions scheduled workflow** | ✅ now | ~free (private-repo minutes) | Low — drives existing CLI | Reuses `sync:venues` verbatim; secrets in GH; perfect for pre-heavy-testing |
| **AWS Lambda + EventBridge Scheduler** | ✅ later | negligible | Medium | Matches the "lambda" ask; Node runtime reuses the code; **one city per invocation** (15-min ceiling — see below) |
| **Railway cron service** | ✅ later | low | Low if API already on Railway | Same Node code, co-located with the API |
| Supabase Edge Function + `pg_cron` | ⚠️ poor | free | High | Deno rewrite of the Node/Drizzle/pg sync; ~150–400s wall limit too short for multi-city |

**Why not just Lambda immediately:** a single `syncCity` walks 4 included types ×
up to 3 pages with a **2-second delay between pages** (`syncVenues.ts`), plus
geocode + per-venue upsert. That's minutes per city; several cities in one
invocation risks the **15-minute Lambda ceiling**. If we go Lambda, the right
shape is **one city per invocation**, fanned out by EventBridge Scheduler (or a
Step Functions map / SQS), which also isolates per-city failures.

### Recommendation

> **Stage now:** a **GitHub Actions scheduled workflow** that runs the existing
> `sync:venues` CLI over a committed city list. Zero new spend, reuses built
> code, and gets multi-city live data into Supabase immediately — exactly what
> "ready for heavy testing" needs.
>
> **Graduate to:** **AWS Lambda + EventBridge (one city per invocation)** — or a
> **Railway cron** if the API lands on Railway — once the sync needs to run
> independently of CI, on a tighter cadence, or in a production posture.

This respects the documented cost concern (no always-on infra to populate data)
while keeping a clean upgrade path to the Lambda the user asked about.

---

## 4. Phased Plan

Each phase is independently shippable and has explicit acceptance criteria so the
work can proceed without constant check-ins.

### Phase 0 — Decisions & prerequisites

- **[Decide]** Live-read path — **where the API is hosted** now that Railway is paused: reactivate Railway, move to a free/cheaper host (Render/Fly), run the API locally against Supabase for solo testing, or drop the host entirely and build Mode B (Supabase-direct). See Decision D1. *Recommend: local API for solo E2E now; reactivate Railway (or Render/Fly) when remote testers need an endpoint; defer Mode B.*
- **[Decide]** Cloud target for the sync (Section 3 recommendation: GH Actions now).
- **[Decide]** The initial **city list** (names + state codes + radius). Section 6.
- **[You]** Supabase project exists, PostGIS enabled, `DATABASE_URL`/`DIRECT_URL` in hand.
- **[You]** Google Cloud project with **Places API (New)** + **Geocoding API** enabled; `GOOGLE_PLACES_API_KEY` issued and billing-capped (Section 7).

**Acceptance:** decisions recorded; `apps/api/.env` populated; `npm run sync:venues -- --city Charlotte --state NC --dry-run` runs end-to-end locally (after Phase 1 fixes the dry-run).

### Phase 1 — Refine the pipeline (data quality + safety)

Close the verified gaps so live data is actually usable in the UI.

1. **Make `--dry-run` real.** Thread a `dryRun` flag into `syncCity()` that skips
   `upsertVenues` + the soft-deactivate `UPDATE`, and reports what *would* change.
2. **Populate `imageUrl`.** In `transform.ts`, resolve the first `place.photos[]`
   entry via `PlacesClient.buildPhotoUrl()` (or store the photo `name` and resolve
   at read time to avoid embedding the API key). Decide storage vs on-demand (D2).
3. **Populate `description` and `highlights`** from available Places fields
   (e.g. editorial summary if added to the field mask, or derive highlights from
   `types`/`priceLevel`/`rating`). If no good source, leave defaulted and note it.
4. **Handle `isOpen` honestly.** Per the schema TODO, derive open/closed from
   `hours` + current time at read time rather than storing a stale `true`. Minimal
   version: a helper in the venue service; do not let the sync write a misleading value.
5. **Unit tests** for each transform change (the repo already has
   `tests/jobs/places/transform.test.ts` and `filters.test.ts` to extend).

**Acceptance:** a dry-run prints a diff and writes nothing; a real single-city
sync produces venues with images and non-misleading open state; transform tests pass.

### Phase 2 — Cities API + mobile wiring

1. **Add `GET /api/v1/cities`** (active cities from the `cities` table) following
   the existing route/service/repository pattern. Add a Zod schema + route test.
2. **Wire `useCities`** to the new endpoint when `hasApi`, using the already-written
   `rowToCity` mapper; keep the mock fallback.
3. Confirm `useVenues`/`useVenue`/`useVoteState`/`useCastVote` need no changes —
   they already branch on `hasApi`.

**Acceptance:** with `EXPO_PUBLIC_API_URL` set, the city picker lists cities from
the DB and venue lists load live per city.

### Phase 3 — Multi-city population (batch orchestration)

1. **City config file** (committed): a list of `{ city, state, radius, maxPerType }`
   — the single source of truth for "which cities Crawl covers."
2. **Batch runner:** a small script (`sync:venues:all`) that reads the config and
   calls `syncCity()` per city **sequentially**, aggregating results and exiting
   non-zero if any city hard-fails. Sequential (not parallel) keeps Places API
   QPS and cost predictable.
3. **Idempotency check:** confirm re-running is safe (it is — upsert by
   `google_place_id` + soft-deactivate of stale venues already implemented).

**Acceptance:** one command populates all configured cities into Supabase; a
second run is a no-op-ish upsert with stable counts.

### Phase 4 — Automate on the cloud

**Now (GitHub Actions):**

1. Scheduled workflow (`.github/workflows/sync-venues.yml`), nightly cron, that
   installs deps and runs `sync:venues:all` against Supabase.
2. Secrets as GitHub Environment secrets: `DATABASE_URL` (or `DIRECT_URL` for
   writes), `GOOGLE_PLACES_API_KEY`. `workflow_dispatch` for manual/dry-run runs.
3. Fail the job (and alert) on per-city errors; upload the JSON result as an artifact.

**Later (Lambda/Railway):** package `syncCity()` as a handler invoked **one city
per run**, scheduled by EventBridge; secrets in SSM/Secrets Manager. Or a Railway
cron service running `sync:venues:all` if the API is already on Railway. Wire the
existing (currently stubbed) `scheduleVenueSync` cron pattern from
`jobs/README.md` if we prefer in-process over external.

**Acceptance:** venue data refreshes on a schedule with no laptop involved;
failures are visible; a manual dry-run is one click.

### Phase 5 — Backend cleanup for heavy testing

The "cleaned up and refined … ready for heavy testing" ask, concretely:

1. **Stand up the API read path** (per Decision D1) pointed at a **staging
   Supabase** populated by the sync — never test against prod data. Railway is
   currently paused, so this means reactivating Railway, deploying to a
   free/cheaper host (Render/Fly), or — for solo E2E — running the API locally
   (tunnel via ngrok/cloudflared if other devices need to reach it).
2. **Health + readiness:** confirm `/health` checks DB (and Redis if enabled);
   use it as the deploy gate.
3. **Rate limiting** on `votes` and `auth` (Phase 8 of the backend plan) so load
   testing doesn't get skewed or abused.
4. **Seed vs live parity:** ensure `db:seed` and the live sync produce the same
   venue *shape* so tests written against seed hold against live data.
5. **Test-data strategy:** a repeatable "reset staging DB → migrate → sync N
   cities" script so heavy-test runs start from a known state.
6. **Auth for authenticated flows:** votes require a Supabase JWT; confirm the
   auth path (login → token → `Authorization` header) works E2E. Note: auth *UI*
   in the app is flagged "not yet built" in `DEV_STAGING_PLAN.md` — decide whether
   heavy testing covers authed vote flows now or defers them (D3).
7. **Observability:** structured logs + Sentry on the API so heavy-test failures
   are diagnosable (backend plan Phase 8).

**Acceptance:** the go/no-go checklist in Section 5 is green on staging.

### Phase 6 — Docs & knowledge base

- Update `docs/planning/DATA_PIPELINE.md` and `BACKEND_IMPLEMENTATION_PLAN.md`
  Phase 5 to reflect that the Places pipeline is **built** (not "to research").
- Add a `docs/ops/` runbook for the sync (how to add a city, run a dry-run,
  rotate the Places key) — owned by devops per the agent charter.
- Refresh the wiki source summaries for the pipeline (separate ingest, in-repo).

---

## 5. Heavy-Testing Go/No-Go Checklist

**Data**
- [ ] N cities configured and populated with live venues (Phase 3/4)
- [ ] Venues have images, addresses, hours, ratings; open-state not misleading
- [ ] Re-running the sync is idempotent (stable counts)

**Backend**
- [ ] `USE_REAL_DB=true` against **staging** Supabase
- [ ] Migrations run clean from scratch; `/health` green (DB reachable)
- [ ] `/cities`, `/venues`, `/venues/:id`, `/trending/:city` return live data
- [ ] Vote reset + score recalc crons running against real DB
- [ ] Rate limiting active on `votes` + `auth`
- [ ] Sentry + structured logs capturing errors

**Mobile**
- [ ] `EXPO_PUBLIC_API_URL` → staging API; city picker + venue lists live
- [ ] Loading/error/empty states verified against real latency
- [ ] (If in scope) authed vote flow works E2E

**Automation**
- [ ] Scheduled sync green; failures alert; manual dry-run available

---

## 6. Initial City List (to confirm)

The current mock/seed cities are **Charlotte, NC** and **Patchogue/Sayville, NY**.
Proposed starting set for live population (confirm before Phase 3):

| City | State | Radius (m) | Rationale |
| --- | --- | --- | --- |
| Charlotte | NC | 12000 | Already the primary mock/seed city |
| Patchogue | NY | 8000 | Already seeded; validates a smaller market |
| _add 2–4 more_ | | | Pick target test markets |

Each city is one row in the config from Phase 3. `radius` trades coverage for
Places API cost — larger radius = more searchText pages = more cost.

---

## 7. Cost Considerations

- **Google Places API (New):** billed per request; **Text Search** and
  **Geocoding** are the cost drivers. Per city: 1 geocode + (4 types × up to 3
  pages) Text Search calls ≈ up to 13 requests/city/run, plus photo resolution if
  done at sync time. **Set a billing budget + daily quota cap** in Google Cloud
  before automating. Nightly × few cities is well within reason; guard against a
  runaway loop.
- **Photos:** resolving photo media has its own cost/quota — prefer storing the
  photo `name` and resolving on demand, or cache resolved URLs (D2).
- **Hosting:** stays $0 until Mode C is deployed. GitHub Actions cron uses repo
  minutes only. Lambda cost for a nightly per-city sync is negligible.
- **Supabase:** free tier covers the DB for testing; watch row counts and egress.

---

## 8. Decisions to Confirm

| ID | Decision | Recommendation |
| --- | --- | --- |
| **D1** | Where the app's live read path runs, now that Railway is paused (see D1 detail below) | Local API for solo E2E now; reactivate Railway **or** Render/Fly when remote testers need an endpoint; defer Mode B |
| **D2** | Venue photos: store resolved URL at sync time vs store photo `name` + resolve on read | Store `name`, resolve on demand (avoids embedding key, cheaper, always fresh) |
| **D3** | Does heavy testing include authenticated vote flows now? | Cover unauth read flows first; add authed votes once auth UI exists |
| **D4** | Cloud target: GH Actions now, Lambda vs Railway cron later | GH Actions now; Lambda (one city/invocation) or Railway cron later |
| **D5** | Initial city list + radii | Section 6 — confirm before Phase 3 |
| **D6** | `description`/`highlights` source | Derive from Places fields; if weak, defer and document |

### D1 detail — API host options (Railway paused)

The Fastify API is the app's only live read path today (`venues.ts` reads through
the API, not Supabase). With Railway paused, choose where it runs. Note the
in-process crons (vote reset, hourly score recalc) run wherever the API runs — so
options that drop the API host need a new home for them.

| Option | Recurring cost | Effort | Best for |
| --- | --- | --- | --- |
| **1. Reactivate Railway** (Mode C as planned) | ~$5/mo + usage | ~zero | Fastest path to a working remote endpoint for testers |
| **2. Move to a free/cheaper host** (Render, Fly.io, Koyeb) | $0–low | Low–med — `apps/api/Dockerfile` exists; set env + repoint `EXPO_PUBLIC_API_URL` | Keeping the built API without Railway's bill (Render free sleeps → cold starts; Fly avoids this better) |
| **3. Run the API locally against Supabase** | $0 | ~zero | Solo/dev E2E now; tunnel (ngrok/cloudflared) if other devices must reach it |
| **4. Build Mode B — Supabase-direct reads** | $0 | Med–high | Permanently removing the host tier — but needs new client read path, RLS (partial groundwork in `0002_rls_policies.sql`), and a new home for the crons/vote writes |
| **5. Stay Mode A (mock)** while populating Supabase | $0 | ~zero | Continuing UI/TestFlight work now; flip to a live host later |

**Recommendation:** populate Supabase now (host-independent), test solo via
**Option 3**, and when remote testers need an endpoint pick **Option 1**
(cheapest working remote API, likely less than the eng time for Mode B) or
**Option 2**. Defer **Option 4 (Mode B)** unless permanently eliminating the host
tier is a deliberate goal.

---

## 9. Suggested Sequencing

```
Phase 0 (decisions) ─► Phase 1 (pipeline refine) ─► Phase 2 (cities API + wiring)
                                                          │
                                                          ▼
Phase 5 (staging + cleanup) ◄─ Phase 4 (automate) ◄─ Phase 3 (multi-city batch)
        │
        ▼
Phase 6 (docs)  ──►  Heavy testing (Section 5 checklist green)
```

Phases 1–3 are the critical path to "live data for several cities." Phase 4
(automation) can start once Phase 3's batch runner exists. Phase 5 (staging +
cleanup) is the gate to heavy testing and can overlap Phase 4.
