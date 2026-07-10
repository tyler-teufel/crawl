# Crawl v2 — Product & Design Proposal

**Version:** 2.0 (Planning) · **Status:** Living document · **Adopted into sprint planning:** 2026-07-09

This is the product/design foundation for Crawl v2 — the brand overhaul and UX
direction that future sprints build toward. It is paired with three committed
design deliverables:

| Asset | Contents |
| --- | --- |
| [`docs/design/crawl-v2-brand-sheet.png`](../design/crawl-v2-brand-sheet.png) | Logo suite (wordmark, martini-pin symbol, lockups, monochrome), color palette, Clash Grotesk + Satoshi typography, app icon concepts |
| [`docs/design/crawl-v2-onboarding-flow.png`](../design/crawl-v2-onboarding-flow.png) | Welcome, location permission, sign-in (Apple/Google/anonymous), and branded loading screens |
| [`docs/design/crawl-v2-core-screens.png`](../design/crawl-v2-core-screens.png) | Explore (map + trending), Daily Hotspot Votes, and venue detail screens in the v2 visual language |

How this document relates to the rest of `docs/planning/`:

- The **active backlog** stays in [SPRINT_PLAN_2026-07.md](./SPRINT_PLAN_2026-07.md) — this proposal feeds it (Epic G there maps v2 milestones onto sprints).
- [ROADMAP.md](./ROADMAP.md)'s v2.0 section is superseded in spirit by this document; its feature list survives inside Milestone 7 (Social).

---

## North Star

> **"Where should I go right now?"**

Crawl is a geospatial nightlife discovery platform. It is not trying to beat
Google Maps, Yelp, or Apple Maps at listings — it becomes the **pulse of a
city's nightlife** by combining real-time activity, immersive photography,
social discovery, and location awareness into a premium mobile experience.

**Product philosophy: Spotify meets Apple Maps, for nightlife.** Users should
feel excitement, curiosity, confidence, and anticipation — never the fatigue of
browsing business listings. Every design and engineering decision should
reinforce this. If a proposed feature does not improve the north-star question,
question the feature.

**Mission:** help people discover where the city is alive tonight.
**Vision:** become the default nightlife discovery app — the app people open
*before* deciding where to spend their evening.

## Strategy

Crawl does **not** compete on: largest venue database, most reviews, cheapest
promotions, reservations, or business listings.

Crawl **wins** through: discovery, atmosphere, real-time activity, beautiful
design, social context, and fast decision-making.

**Target audience** — primary: young professionals (22–38), urban residents,
travelers, couples, friend groups. Secondary: hospitality enthusiasts, cocktail
lovers, live-music fans, local explorers.

**Emotional journey:**

```
Excitement ──► Discovery ──► Confidence ──► Going Out ──► Sharing ──► Returning
```

**What Crawl is NOT:** Yelp, TripAdvisor, Google Maps, Foursquare, Facebook
Events, Groupon, OpenTable, or a generic social network.

## Product Principles

1. **Discovery over search** — people browse; search is secondary.
2. **Atmosphere over information** — sell the experience, not the address.
3. **Photography first** — venue photography is always the hero.
4. **Maps support discovery** — maps enhance; they are never the primary experience.
5. **One purpose per screen** — every screen has one primary job.
6. **Motion with purpose** — motion communicates hierarchy and delight, never distraction.
7. **Premium by default** — every interaction feels intentional; no visual noise, no gimmicks.

Every interaction should answer: **Where? Why? Who's there? Should I go?**

## Brand Direction

**Personality:** premium, modern, dark, confident, sophisticated, social, urban.
**Avoid:** loud party branding, corporate SaaS aesthetics, neon overload, cheap gradients.

**Visual inspirations:** Spotify (personalized homepage, rich discovery, strong
hierarchy) · Apple Maps (motion, spatial interactions, polish) · Arc Browser
(delightful transitions, minimal, premium) · Resident Advisor (nightlife
credibility) · Airbnb (large photography, editorial layouts) · Linear
(precision, restraint, consistency).

**Tagline:** *Discover. Drink. Repeat.*

### Logo

The logo family (see brand sheet): lowercase **crawl** wordmark with the "a"
counter replaced by a location pin; a **martini-glass-in-pin** symbol; app
icon; monochrome and full-color variants; horizontal lockup. The selected app
icon concept is the **martini pin** — "a bold representation of bars +
location."

### Color System

Canonical v2 tokens (single source of truth for the design-token work in
Milestone 3):

```js
crawl: {
  purple:        "#7f13ec",   // unchanged — already the brand primary
  purpleLight:   "#a855f7",   // unchanged
  purpleDark:    "#5b0daa",   // unchanged
  background:    "#0a0a0f",   // unchanged (today: crawl-bg)
  surface:       "#16162a",   // unchanged
  card:          "#1a1a2e",   // unchanged
  success:       "#22c55e",   // unchanged (today: crawl-green)
  text:          "#ffffff",
  textSecondary: "#c3c3cf",   // NEW token
  textMuted:     "#8b8ba5",   // CHANGED from today's #9ca3af (cool gray → purple-tinted gray)
  border:        "#27273d",   // NEW token
  divider:       "#222235"    // NEW token
}
```

The v2 palette is an **extension, not a replacement** — the six core colors in
`apps/mobile/tailwind.config.js` already match. Adoption = add the four new
tokens, retint `text-muted`, and align token names (see Reconciliation below).

### Typography

- **Logo/display:** Clash Grotesk (customized, Bold) — logos and headlines.
- **UI/body:** Satoshi (Regular/Medium) — all UI text, chosen for readability.
- **Fallback:** system fonts.

Both faces are Fontshare (Indian Type Foundry) fonts — **not** available via
`@expo-google-fonts`. They ship free under the ITF Free Font License (verify
terms at implementation time), and must be vendored as font files under
`apps/mobile/assets/fonts/` and loaded via `expo-font`. This resolves the
"evaluate 2–3 candidates" exploration in issue #49 → the candidate to beat is
**Satoshi**.

## Information Architecture

### Target v2 navigation

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   Home   │ Discover │   Map    │  Social  │ Profile  │
└──────────┴──────────┴──────────┴──────────┴──────────┘
     │           │          │          │          │
 Personalized  Categories  Contextual  Friends,  Saved venues,
 discovery     and         exploration shared    crawls,
 (Spotify-     collections (never the  crawls,   activity
 style feed)               landing     check-ins
                           page)
```

- **The map is never the landing page.** The homepage resembles Spotify, not
  Apple Maps: greeting ("Good evening — Charlotte is buzzing tonight"),
  Trending Tonight, category rails (Rooftops, Live Music, Wine Bars, Hidden
  Gems), Friends Nearby, Popular Crawls, Editor's Picks, Nearby Now — with a
  small embedded map lower on the page.
- **Venue detail:** hero imagery, live activity, reviews, friends, events.

### Current vs. v2 IA

```
 Today (v1.x)                        v2 target
┌─────────┬────────┬────────┬─────────┐   ┌──────┬──────────┬─────┬────────┬─────────┐
│ Explore │ Voting │ Global │ Profile │ ─►│ Home │ Discover │ Map │ Social │ Profile │
└─────────┴────────┴────────┴─────────┘   └──────┴──────────┴─────┴────────┴─────────┘
  map-first  daily    place-   place-
             votes    holder   holder
```

Note: the committed v2 mockups intentionally show the **new visual language on
the current 4-tab IA** (Explore/Voting/Global/Profile) — that is the reskin
milestone. The 5-tab restructure is a later milestone (Discovery Experience),
and where **Daily Hotspot Votes** lives in the 5-tab world is an open product
decision (see Open Decisions).

## Design System Vision

Everything reusable, tokens centralized. Component inventory to build/formalize
in Milestone 3: buttons, venue cards, collection cards, map pins, search bar,
bottom sheets, navigation, badges, filter chips, voting cards, skeletons,
toasts, loading indicators, empty states, avatar groups, tag pills, venue
status indicators.

**Motion guidelines:** 60fps, spring animations, gentle parallax, shared-element
transitions, micro-interactions, haptics, subtle opacity transitions. No flashy
animations.

**Accessibility:** high contrast, Dynamic Type, VoiceOver labels, ≥44pt touch
targets, reduced-motion support, semantic navigation, color never the only
indicator.

## Engineering Principles

Prefer composition · avoid duplication · feature-first organization · reusable
components · centralized design tokens · typed APIs · strict TypeScript ·
themeable architecture · accessibility first · performance conscious.

### Target folder structure (mobile)

```
app/                      # expo-router screens (unchanged)
components/  ui/ cards/ forms/ navigation/ maps/
features/    discovery/ venues/ social/ profile/ crawls/
services/    api/ supabase/ location/
hooks/  providers/  theme/  constants/  types/  utils/
```

Today's `src/{types,data,constants,context,hooks,lib,api}` + domain-organized
`components/` is close in spirit; the deltas are **feature-first modules**
(`features/*`), a **theme/** home for design tokens, and `services/` replacing
`src/api` + `src/lib/supabase`. This restructure is Milestone 2 work and should
happen *after* the monorepo root-migration completes, not alongside it.

## Metrics

**North star: Weekly Active Discoveries.**
Supporting: DAU, WAU, session length, venue views, saves, crawl creations,
friend interactions, return rate, check-ins, shares.

## Milestones

The v2 GitHub milestone ladder, and how it meets the in-flight July sprint plan:

| # | Milestone | Scope | Sprint mapping |
| --- | --- | --- | --- |
| M1 | Foundation | v2 audit (repo/UX/design/database) + brand assets landed + versioning/CI hygiene | Sprint 1 (done items) + **Sprint 5 audit ticket** |
| M2 | Architecture Refactor | Feature-first folders, services layer, theme/ tokens, Supabase decision | Sprint 5–6 |
| M3 | Design System | Token centralization, component library buildout, DESIGN_SYSTEM.md | Sprint 6–7 |
| M4 | Discovery Experience | Spotify-style Home, Discover tab, 5-tab IA restructure | Sprint 7+ |
| M5 | Venue Experience | Hero-photography venue detail, live activity, reviews | Sprint 8+ |
| M6 | Map Experience | Contextual map, custom pins, bottom sheets | Sprint 8+ |
| M7 | Social Features | Friends, shared crawls, check-ins (absorbs ROADMAP v2.0 table) | Sprint 9+ |
| M8 | Personalization | Recommendations, greeting/context engine | Later |
| M9 | Performance | 60fps audit, image pipeline, startup time | Later |
| M10 | Launch Readiness | Accessibility pass, App Store assets, onboarding polish | Later |

**Already-scheduled work that v2 folds into (do not re-plan):**

- **Sprint 2 (#48 splash/logo, #49 fonts/onboarding)** now has its design
  direction delivered — see the design assets above. #48's "logo artwork is a
  design deliverable" blocker is resolved by the brand sheet; #49's font
  exploration resolves to Satoshi (+ Clash Grotesk display).
- **Sprint 3 (#50 Global Rankings)** and **Sprint 4 (#51 Profile)** proceed as
  planned, but should build against the v2 visual language (tokens, Satoshi)
  once Sprint 2 lands, so they're not immediately reskinned in M4.

## Backend Architecture & Scaling Strategy

**Decided 2026-07-10 (resolves Open Decision #1): ratify the hybrid for v1;
Supabase-native as the long-term center of gravity; a dedicated API tier
returns only where a measured bottleneck earns it.**

The recurring worry — *"how does this scale long-term reading Supabase
directly, with no API?"* — rests on a false premise. **"Supabase-direct" does
not mean "no backend."** It means the API tier stops being a single Node
process we host and instead composes from Supabase's server-side primitives.
The logic, the authorization, and the trust boundary all still exist — they
move closer to the data.

### The API doesn't disappear — it decomposes

```
                    Supabase project (single trust boundary: RLS)
 mobile app  ┌────────────────────────────────────────────────────┐
 (anon key + │  PostgREST     ── auto REST/GraphQL over tables     │
  user JWT)  │  RPC / SQL fns ── transactional business rules      │──► Postgres 17
 ───────────►│  Edge Functions── custom logic, secrets, 3rd-party  │    + PostGIS
             │  Realtime      ── logical replication → websockets   │    + pg_cron
             └────────────────────────────────────────────────────┘
                       every path gated by Row-Level Security
```

Four layers replace the one Fastify tier, each earning its place:

| Concern | Supabase-native mechanism | Why it scales |
| --- | --- | --- |
| **Reads** (venues, cities, rankings) | PostgREST over the tables, gated by RLS | Bulk of traffic; standard Postgres read scaling — indexes, PostGIS GiST, pooling, read replicas, materialized views for feeds |
| **Trusted writes** (vote cap, dedup) | Postgres RPC (`cast_vote`, `SECURITY DEFINER`) + constraints | Rule lives *inside the transaction* — a client can't bypass it, unlike app-tier checks |
| **Secrets / 3rd-party** (Places sync, push, images) | Edge Functions (Deno) + scheduled jobs (`pg_cron`/`pg_net`, both installed) | Secrets stay server-side; jobs run detached from the client |
| **Live activity** (hotspot pulse, social) | Realtime (Postgres → websockets) | Free and native; on Fastify this means hand-rolling a socket tier |
| **Authorization** | RLS policies on every table | One enforcement point regardless of entry path — this is what makes "direct" *safe* |

### Why "direct" is safe, not reckless

The client ships a **public anon key** — by design. It grants nothing on its
own: **Row-Level Security is the authorization layer**, enforced in the
database on every query no matter who calls it. Today's policies already scope
this correctly — `venues`/`cities` public-read, `votes`/`users` own-row-only —
so a client holding the anon key still can't read another user's votes or write
outside policy. In the Fastify model that same authorization is hand-written
middleware we maintain; here it is declarative and lives with the data.

### How far it scales, and the levers

Because it is **just Postgres**, it scales the way Postgres scales — nothing
exotic:

- **Vertical** — larger compute/RAM (a config change).
- **Connection pooling** — Supavisor/pgBouncer front the DB so thousands of
  mobile clients don't exhaust connections.
- **Indexes + PostGIS GiST** — geo radius queries (`ST_DWithin`) stay fast
  (#75; the spatial column isn't wired yet).
- **Materialized views / cached aggregates** — the Spotify-style Home feed and
  rankings precompute rather than recomputing per request.
- **Client + edge cache** — TanStack Query already dedupes/caches on-device; a
  CDN/edge cache fronts read-heavy anonymous endpoints.

For an app of this shape (read-dominant discovery, geospatial, a modest write
loop) this comfortably covers launch through significant growth. Cost scales
predictably with DB size, egress, function invocations, realtime connections,
and MAUs — and it avoids the *fixed* always-on compute bill a separate Fastify
tier (Railway) adds regardless of traffic.

### When a dedicated API tier comes back — by measurement, not fear

Supabase-native is the default, not a dogma. A thin backend service re-enters
the moment a **specific, measured** need appears:

- Complex multi-step orchestration awkward to express in SQL/Edge Functions.
- Aggregating several third-party APIs with bespoke caching/rate-limiting.
- Very high write throughput needing custom batching.
- Vendor-portability requirements (wanting to sit behind our own tier).

The critical property: **adding it later is not a re-architecture.** Edge
Functions already *are* that tier, incrementally — a function grows into a
service only where the bottleneck is. And the data layer stays **vanilla
Postgres + open-source PostgREST/GoTrue**, so there is no data-layer lock-in: if
Supabase is ever outgrown, the database migrates to any Postgres host and a
custom API drops back in front. We keep `apps/api` (Fastify/Drizzle) as exactly
that escape hatch — retained and reduced, not deleted.

### What this means concretely

- **v1 (now):** flip reads to Supabase-direct behind the existing
  `USE_REAL_API`/`hasApi` flag (data + RLS already there — #78); votes stay mock
  or move to a `cast_vote` RPC; **Railway stays unpaid** (#78).
- **v2 function overhaul:** live activity, social, crawls, and check-ins land on
  Realtime + RLS + Edge Functions — the features that most wanted a bespoke
  backend are the ones Supabase gives for free.
- **Escape hatch:** `apps/api` stays in the monorepo as the measured-bottleneck
  tier; the Sprint 5 audit re-confirms the boundary as the data model grows.

---

## Reconciliation with Current State — Open Decisions

Flagged per the "state assumptions explicitly" ground rule. Each needs an
explicit decision (filed in `docs/architecture/DESIGN_DECISIONS.md` when made):

1. **Supabase vs. custom Fastify API.** ✅ **RESOLVED 2026-07-10** — ratified
   **hybrid for v1, Supabase-native as the v2 center of gravity**; rationale and
   scaling model in [Backend Architecture & Scaling Strategy](#backend-architecture--scaling-strategy)
   above, formal entry pending in `DESIGN_DECISIONS.md`. Follow-ups cut: #75
   (PostGIS spatial column), #76 (schema/migration-ledger drift), #77 (retire
   dead custom-auth), #78 (read cutover + Railway billing). Original framing
   retained below for the record.

   The v2 stack line says "Supabase."
   Today Supabase already handles **auth** (`src/lib/supabase.ts`,
   `AuthContext`) **and hosts the core domain tables** (see the verified
   snapshot below), while `apps/api` is a Fastify + Drizzle + Postgres server
   per BACKEND_IMPLEMENTATION_PLAN.md. Options: (a) all-in on Supabase
   (Postgres + PostGIS + RLS + realtime; `apps/api` retired or reduced to edge
   functions), (b) keep the split (Supabase = auth only, Fastify = domain API),
   (c) hybrid. This is the biggest architectural fork in M2 — decide before
   any backend buildout resumes. The snapshot below reframes it: Supabase is
   already more than an auth provider here, so the split (option b) would mean
   *migrating* the existing `venues`/`votes`/`cities`/`users` tables off
   Supabase, not just leaving them there. Weigh that against `apps/api`'s
   Drizzle schema (confirm whether the two describe the same tables or have
   already diverged — part of the Sprint 5 audit).

   **Verified Supabase snapshot — updated live 2026-07-10** (connector now
   authorized; project `gcixoqaxahuawklcqzyq` "Crawl", Postgres 17.6, us-east-1,
   `ACTIVE_HEALTHY`):

   | Table | RLS | Rows (2026-07-10) |
   | --- | --- | --- |
   | `public.cities` | enabled, public-read | 4 |
   | `public.venues` | enabled, public-read | 240 |
   | `public.users` | enabled, own-row | 1 |
   | `public.votes` | enabled, own-row | 0 |

   - **Data is now live** — the 2026-07-09 snapshot showed all tables empty; the
     seed has since run (240 venues, 4 cities). Real read data is a flag flip
     away (#78), not a build-out.
   - **PostGIS is enabled** (3.3.7) but unused — `venues.location` is `text` and
     lookups filter city text (`ilike`), no `ST_DWithin` (#75).
   - **RLS policy contents verified** and sensibly scoped (public-read on
     venues/cities, own-row on votes/users). The advisor's "anonymous access"
     WARN is expected given anonymous browsing — a conscious sign-off, not a
     hole.
   - **No migration ledger** (`list_migrations` empty; schema pushed via
     `drizzle-kit push`) and deployed columns exceed `shared-types` — drift to
     reconcile (#76). Dead `users.password_hash` lingers from the retired
     custom-auth path (#77).
   - The v2 data model still calls for more — `crawls`, social graph,
     `check-ins`, `collections`, `activity feed` — **none of which exist yet**.
     That gap remains the core of the Sprint 5 database review.
2. **Where does voting live in the 5-tab IA?** Daily Hotspot Votes is the
   current app's core loop and the mockups keep it as a tab; the v2 IA
   (Home/Discover/Map/Social/Profile) doesn't name it. Candidates: fold into
   Home as a card/rail, into Social, or keep a dedicated tab (6 tabs is off the
   table per design restraint).
3. **Global Rankings' v2 home.** #50 ships it as a tab in Sprint 3; the v2 IA
   has no Global tab. Likely destination: a Discover collection or Home rail.
   Build #50 with extraction in mind (screen = thin wrapper over reusable
   list components).
4. **Docs structure.** The proposal's flat docs list (PRODUCT_BIBLE.md,
   DESIGN_SYSTEM.md, …) maps onto the existing `docs/` tree rather than
   replacing it: PRODUCT_BIBLE → this file · AUDIT → `docs/planning/` (v2 audit
   output) · DESIGN_SYSTEM + COMPONENT_LIBRARY + BRAND_GUIDELINES →
   `docs/architecture/` (M3 deliverables) · UX_PRINCIPLES +
   INFORMATION_ARCHITECTURE → sections here until they outgrow it · ROADMAP →
   existing `ROADMAP.md` · DECISIONS → existing `DESIGN_DECISIONS.md`.
5. **Token naming migration.** v2 token names (`background`, `success`,
   `textMuted`) differ from today's Tailwind keys (`bg`, `green`,
   `text-muted`), and the semantic-vs-crawl dual color system
   (CLAUDE.md § Styling) needs a consolidation plan in M3 — likely: v2 crawl
   tokens become the values behind the semantic CSS variables.

## First v2 Task — Comprehensive Audit (M1, proposed Sprint 5)

Before implementing v2 product changes beyond the already-scheduled Sprint 2–4
work: a full audit producing recommendations labeled **✅ Keep · 🔄 Refactor ·
❌ Replace · ➕ Add**, covering:

- **Repository:** folder organization, Expo Router usage, component reuse,
  NativeWind/theme implementation, Supabase integration, navigation, state
  management, auth, performance, accessibility, consistency, tech debt,
  testing, CI/CD.
- **UX:** information hierarchy, navigation, onboarding, empty/loading states,
  search, discovery, venue detail, map interactions, social flows.
- **Design:** consistency, typography, color usage, spacing, elevation, icons,
  photography, motion, branding.
- **Database:** normalization, relationships, venue/user models, crawls,
  social graph, activity feed, check-ins, votes, collections — with schema
  recommendations. Starting point: the verified 2026-07-09 snapshot in Open
  Decision #1 (4 tables, RLS on, empty). Connector access **confirmed working**
  2026-07-09; still pair with the deployed-schema reality check from #66.

Output: `docs/planning/CRAWL_V2_AUDIT.md` + follow-up tickets, PR'd for review.
No v2 implementation (beyond Sprints 2–4 as scoped) starts before the audit
lands.

## Collaboration Expectations

Treat this as a long-term product partnership: challenge assumptions, explain
tradeoffs, recommend better UX and architecture, favor simplicity, think in
MVP / v2 / long-term horizons, and keep documentation synchronized with
decisions.
