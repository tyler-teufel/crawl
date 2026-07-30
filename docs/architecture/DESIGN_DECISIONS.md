# Design Decisions

Rationale behind every major technical choice in the Crawl app. Each section explains what was chosen, what the alternatives were, and why this approach won.

---

## expo-router (File-Based Routing)

**Chosen over:** Manual React Navigation configuration

Expo-router maps the file system to the navigation tree. `app/(tabs)/voting.tsx` becomes the `/voting` route automatically.

**Why:**

- **Self-documenting routes** — new screens are just new files. No route registration boilerplate.
- **Free deep linking** — every route is a URL. Critical for sharing venue links (`crawl://venue/123`) later.
- **Layout nesting** — `_layout.tsx` files make provider/navigator hierarchy visible at the filesystem level.
- **Convention over configuration** — parenthesized groups `(tabs)` create navigators, square brackets `[id]` create dynamic params, all without manual setup.

**Trade-off:** Less flexibility than raw React Navigation for highly custom navigation patterns. Not an issue for Crawl's standard tab+stack+modal structure.

---

## NativeWind (Tailwind CSS for React Native)

**Chosen over:** `StyleSheet.create()`, styled-components, Tamagui

**Why:**

- **Development speed** — utility classes are faster to write and iterate than named style objects. `className="flex-1 bg-primary p-4 rounded-lg"` vs. defining a `StyleSheet` with named properties.
- **Centralized design system** — `tailwind.config.js` defines the full color palette, spacing scale, and typography. Every component pulls from the same source.
- **Tooling** — `prettier-plugin-tailwindcss` auto-sorts class names, eliminating formatting debates. Tailwind IntelliSense provides autocomplete.
- **Web familiarity** — developers with Tailwind CSS experience on the web can immediately read and write React Native styles.
- **RNR compatibility** — React Native Reusables is built on NativeWind, so the styling system is fully aligned.

**Trade-off:** Longer `className` strings can be harder to scan than named styles. Mitigated by Prettier sorting and the `cn()` utility for conditional logic.

---

## React Native Reusables (Component Library)

**Chosen over:** Building all UI components from scratch, UI Kitten, React Native Paper, Tamagui

**Why:**

- **Source ownership** — components are copied into the project as editable source code, not imported from a package. This means no version lock-in and full customization control.
- **Tailwind-native** — built on NativeWind with the same CSS variable theming as shadcn/ui. Components automatically pick up the Crawl theme from `global.css`.
- **Accessible primitives** — built on `@rn-primitives/*` which handle ARIA roles, keyboard navigation, and screen reader support.
- **Incremental adoption** — add components one at a time. No all-or-nothing framework commitment.

**Trade-off:** No automatic updates — when RNR releases improvements, you manually update individual component files. In practice, this is fine because components are customized after adoption anyway.

---

## Clash Grotesk + Satoshi Custom Fonts

**Chosen over:** System default font, Google Fonts (Inter/Space Grotesk)

Crawl's brand typography (defined in the Figma design system) pairs **Clash Grotesk** (display/headings) with **Satoshi** (body text). Both are commercial Fontshare families, licensed and loaded as static `.otf` files rather than pulled from Google Fonts.

**Why:**

- **Brand fidelity** — matches the typography specified in the Figma design system exactly, rather than substituting a visually-similar free alternative.
- **Static weights over variable font** — Expo's `expo-font` loads named weight files directly (`ClashGrotesk-SemiBold.otf`, `Satoshi-Medium.otf`, etc.) rather than the variable `.ttf`, since React Native has no `font-variation-settings` support for dynamically selecting weight from a single variable font file.
- **Curated weight subset** — only the weights actually used in the UI are bundled (Clash Grotesk: Medium/SemiBold/Bold; Satoshi: Regular/Medium/Bold), keeping bundle size down instead of shipping the full family (which also includes Light/Extralight/Black/Italics).

**Implementation:** Font files live in `apps/mobile/assets/fonts/`, loaded via `useFonts` in `app/_layout.tsx` (gated behind `expo-splash-screen`'s `preventAutoHideAsync`/`hideAsync` so there's no flash of the system font), and exposed as NativeWind classes (`font-display`, `font-display-medium`, `font-display-bold`, `font-sans`, `font-sans-medium`, `font-sans-bold`) via `tailwind.config.js`.

**Trade-off:** Adds ~270KB across 6 font files to the bundle, and license files (`ClashGrotesk-LICENSE.txt`, `Satoshi-LICENSE.txt`) must ship alongside the fonts per Fontshare's terms.

---

## Map Placeholder Instead of react-native-maps

**Chosen over:** Immediate `react-native-maps` integration

**Why:**

- **No native build required** — `react-native-maps` requires native module linking, platform-specific API keys (Google Maps for Android, Apple Maps for iOS), and Xcode/Android Studio setup. The placeholder lets the team validate UX flows in Expo Go without any of that.
- **Same component interface** — `MapPlaceholder` accepts `venues: Venue[]` and `onPinPress: (venue) => void`, exactly what a real map wrapper would accept. Swapping is a single import change.
- **Animation validation** — the pulsing glow on `MapPin` proves that reanimated animations work correctly before adding the complexity of rendering inside `<Marker>` components.

**Migration path:** See [Maps Integration Guide](../guides/MAPS_INTEGRATION.md).

**Status:** Migrated. The Explore screen now renders `CrawlMapView` (real `react-native-maps`) when the native module is present and falls back to `MapPlaceholder` only when running in environments without the native build (e.g., Expo Go without a dev client). The placeholder remains in the tree as a graceful fallback, not the default path.

---

## React Context for State Management

**Chosen over:** Zustand, Redux, Jotai, MobX

**Why:**

- **Simplicity** — the app state is small: 10 filter toggles, a search string, a city name, and a vote tracker with 3 slots. Context handles this without any external dependency.
- **Co-location** — all state consumers are within the same component tree (tabs, modals, detail screens). No cross-tree or cross-app communication needed.
- **No async cache** — there's no server data to cache, invalidate, or deduplicate. When a backend exists, TanStack Query will handle that layer separately.
- **Zero learning curve** — `useContext` is a standard React primitive.

**Why at root (not per-tab):** The filter modal (`/filters`) is a separate route rendered outside the `(tabs)` layout group. If the provider lived inside `(tabs)/_layout.tsx`, the modal couldn't access filter state. Hoisting to `app/_layout.tsx` ensures all routes share the same context instance.

**Future plan:** When backend integration happens, split into:

- TanStack Query for server state (venues, votes, user data)
- Context or Zustand for UI-only state (filter toggles, search text)

---

## react-native-svg for the Hotspot Score Ring

**Chosen over:** Canvas-based solutions, pre-rendered images, CSS-only approaches

**Why:**

- **SVG `strokeDashoffset`** — the canonical technique for animated circular progress indicators. A `<Circle>` element with `strokeDasharray` set to the circumference and `strokeDashoffset` animated from full to partial creates a smooth fill effect.
- **Reanimated integration** — `Animated.createAnimatedComponent(Circle)` + `useAnimatedProps` drives the SVG attribute on the UI thread at 60fps. No JS thread blocking.
- **Cross-platform consistency** — renders identically on iOS and Android with no platform-specific code.
- **Lightweight** — only imports `Svg` and `Circle` from the library. The full SVG feature set is available if needed later (charts, custom shapes).

---

## Ionicons for Icons

**Chosen over:** MaterialIcons, FontAwesome, custom SVG icons, Lucide

**Why:**

- **Zero dependency** — `@expo/vector-icons` ships bundled with every Expo project. Ionicons is included in that bundle.
- **Outline/filled pairs** — every icon has both an outline variant (inactive state) and a filled variant (active state), which matches the tab bar and button patterns in the app.
- **Comprehensive set** — covers all current needs: compass, heart, globe, person, search, options, beer, flame, musical-notes, location, navigate, sparkles, etc.

---

## Dark Mode Forced On

**Chosen over:** System preference detection, manual toggle, light-first design

**Why:**

- **Nightlife context** — Crawl is designed for use in dark environments (bars, clubs). A dark UI reduces eye strain and screen glare.
- **Design consistency** — all mockups and design tokens were created for a dark theme. Supporting light mode would require designing and testing a second visual language.
- **Simplified development** — one theme to maintain, one set of colors to test against.

**Future flexibility:** The theme system supports light mode out of the box (light tokens exist in `global.css` and `src/lib/theme.ts`). To enable light mode, remove the `useEffect` that forces dark in `app/_layout.tsx` and let `useColorScheme` follow the system preference.

---

## `inlineRem: 16` in Metro Config

**Chosen over:** Default rem handling

**Why:** React Native doesn't have a browser-like `rem` unit. NativeWind's `inlineRem: 16` converts all rem-based Tailwind utilities (font sizes, spacing) to absolute pixel values using a 16px base. This ensures consistent sizing across platforms and matches web Tailwind defaults. Required by RNR for correct component sizing.

---

## Prettier Plugin for Tailwind Class Sorting

**Chosen over:** Manual class ordering, ESLint rules

**Why:** Tailwind class strings can become long. Without consistent ordering, the same styles look different in every file. `prettier-plugin-tailwindcss` auto-sorts classes on save in a canonical order (layout → spacing → sizing → typography → colors → etc.), eliminating all formatting debates and making className strings scannable.

---

## Error Monitoring: Sentry (`@sentry/react-native`)

**Chosen over:** Bugsnag, Rollbar, raw `console.error` + log shipping, no monitoring

**Why:**
- **Free tier covers our scale** — 5K errors, 10K performance units, 50 replays per month, org-wide. Enough for a pre-launch app with a small beta cohort.
- **Expo-first integration path** — `@sentry/react-native/expo` ships an Expo config plugin that wires native modules without requiring `expo prebuild` to be run by hand. Drop-in `Sentry.wrap(RootLayout)` captures unhandled JS errors and React render errors.
- **Source maps + iOS debug symbols** — the same plugin uploads them at build time so stack traces deminify in the Sentry UI.
- **Mobile session replay** — captures the last few seconds of UI before a crash for debugging unrepro-ables. We turn off proactive session replay (`replaysSessionSampleRate: 0`) and only record on errors (`replaysOnErrorSampleRate: 1.0`) to stay under quota.

**Configuration choices for free-tier sustainability:**
- `tracesSampleRate: 0.1` — sample 10% of transactions for performance monitoring.
- `replaysSessionSampleRate: 0` — no proactive session replays.
- `replaysOnErrorSampleRate: 1.0` — always replay sessions where an error fired.
- `enabled: !__DEV__` — never ship dev-mode noise to Sentry.
- DSN read from `EXPO_PUBLIC_SENTRY_DSN`, never hardcoded, so dev/staging/prod can route to different Sentry projects.

**Trade-off:** Source map upload requires `SENTRY_AUTH_TOKEN` set in the EAS build env (`eas secret:create`). Without it, builds still succeed but stack traces will be minified in Sentry. Documented in `apps/mobile/.env.example`.

---

## API Framework: Fastify

**Chosen over:** Express, Hono, NestJS

**Why:**
- **Performance** — Fastify is 2-3× faster than Express on identical benchmarks. This matters for the vote and trending endpoints that will be called frequently.
- **Schema-first validation** — Fastify's built-in JSON Schema validation runs before route handlers, rejecting bad requests before they touch business logic. Paired with `fastify-type-provider-zod`, Zod schemas double as runtime validators and TypeScript types — no duplication.
- **Plugin system** — `fastify-plugin` makes decorators (like `fastify.authenticate`) available across the whole app without awkward middleware chains.
- **First-class TypeScript** — the `withTypeProvider<ZodTypeProvider>()` pattern gives typed `request.params`, `request.query`, and `request.body` inside every handler.
- **Testability** — `fastify.inject()` lets you make real HTTP requests against the Fastify instance without starting a TCP listener. Tests are fully isolated and fast.

**Trade-off:** Smaller ecosystem than Express. Some middleware packages don't exist for Fastify. In practice, the Fastify ecosystem covers all Crawl's needs (`@fastify/jwt`, `@fastify/cors`, `@fastify/sensible`).

---

## API Architecture: Controller-Service-Repository

**Chosen over:** Fat route handlers, Active Record pattern, direct DB access in routes

**Why:**
- **Testability** — services are plain TypeScript classes with no HTTP coupling. Unit tests call `voteService.castVote(userId, venueId)` without mocking Fastify.
- **Swappable repositories** — Phase 1 uses in-memory repositories. Phase 2 swaps them for Drizzle-backed implementations behind the same interface. No route handler changes required.
- **Separation of concerns** — routes handle HTTP translation (params, headers, status codes); services handle business rules (max votes, duplicate checks); repositories handle persistence.

**Pattern:**
```
Route handler (HTTP)  →  Service (business logic)  →  Repository (persistence)
```

---

## ORM: Drizzle

**Chosen over:** Prisma, Kysely, raw pg

**Why:**
- **SQL-like syntax** — Drizzle queries read like SQL. `db.select().from(venues).where(eq(venues.city, city))` maps directly to developer mental models.
- **Lightweight** — no code generation step, no Prisma Engine binary. The library is pure TypeScript.
- **Inferred types** — schema defined once in `src/db/schema.ts`; `$inferSelect` and `$inferInsert` produce correct TypeScript types automatically.
- **Drizzle Kit migrations** — `drizzle-kit generate` diffs the schema and produces versioned SQL migration files.
- **Runs everywhere** — works with node-postgres, Neon serverless, Bun, and edge runtimes without configuration changes.

**Trade-off:** Less mature than Prisma; fewer generated helpers (no `findMany` with nested include). In practice Drizzle's query builder covers all Crawl's query patterns.

---

## Migration Ledger: `drizzle-kit generate` Only, Never `push` (#76)

**Chosen over:** continuing to apply schema changes with `drizzle-kit push`.

**The problem:** the live Supabase schema was being applied with `drizzle-kit push`, which diffs `schema.ts` against the live database and applies the delta directly — it never writes a row to Drizzle's migration-tracking table and doesn't require a migration file to exist at all. As of 2026-07-28, `apps/api/drizzle/` already contained `0000_redundant_excalibur.sql` (the initial schema) plus two later hand-authored files (`0001_venue_filter_indexes.sql`, `0002_rls_policies.sql`), but the live database's own migration ledger had zero recorded entries — the deployed schema and the files describing it had never been connected through `drizzle-kit migrate`. Every change since had been unauditable: nothing recorded *when* a given shape went live or *which* file, if any, produced it.

**Verifying the existing files matched reality:** the columns `drizzle-kit generate` infers from `schema.ts` were checked column-by-column against a live introspection of `public.users`, `public.venues`, and `public.cities` taken the same day. They agreed — `0000_redundant_excalibur.sql` is a faithful baseline of what's deployed today, not a change. `drizzle-kit check` also reports no drift between `schema.ts` and the current snapshot chain.

**Why:**
- **`generate` produces a file before anything is applied.** Every schema change becomes a reviewable SQL diff in version control, checked in alongside the `schema.ts` edit that produced it.
- **`migrate` records what ran.** Applying a migration through `drizzle-kit migrate` inserts a row into Drizzle's tracking table, so `list_migrations` against the live database becomes a real, queryable history instead of always returning empty.
- **`push` is for local prototyping only**, if ever — never against Supabase/production. It leaves no record of what changed or when, which is exactly the gap this decision closes.

**Trade-off accepted:** one extra step (`generate` then `migrate`, rather than a single `push`) per schema change. Acceptable — the audit trail is the entire point.

---

## Validation: Zod (shared with mobile)

**Chosen over:** Joi, AJV, Yup, TypeBox

**Why:**
- **Shared schemas** — the same Zod schemas used in the API (`apps/api/src/schemas/`) can be imported by the mobile app via `@crawl/shared-types`. One definition governs both request validation and TypeScript types across the full stack.
- **fastify-type-provider-zod** — integrates Zod with Fastify's validation and serialization pipeline with zero custom glue code.
- **TypeScript-first** — `z.infer<typeof schema>` derives the TypeScript type. No separate type definitions.
- **Composable** — `.extend()`, `.pick()`, `.omit()` let schemas be composed without duplication.

---

## Phase 1: In-Memory Repositories

**Chosen over:** Requiring a database for local development / testing

**Why:**
- **Zero setup** — the API boots and all tests pass with no database. Developers can run `npm run dev` immediately after cloning.
- **Fast tests** — no network I/O in unit or integration tests. The full test suite completes in under a second.
- **Interface contract** — the `VenueRepository`, `VoteRepository`, and `UserRepository` interfaces guarantee that swapping to Drizzle-backed implementations (Phase 2) requires no changes to services or routes.

**Migration path (Phase 2):**
1. Provision PostgreSQL with PostGIS (Supabase/Neon/Railway).
2. Set `DATABASE_URL` in `.env`.
3. Run `npm run db:migrate` to apply schema.
4. Implement `DrizzleVenueRepository`, `DrizzleVoteRepository`, `DrizzleUserRepository` behind the existing interfaces.
5. Swap repository construction in `src/app.ts`.

---

## Cron Jobs: node-cron

**Chosen over:** BullMQ, platform-native crons, pg_cron

**Why:**
- **Zero infrastructure** — node-cron runs in-process. No Redis, no separate worker, no external scheduler.
- **Two jobs only** — Crawl has exactly two scheduled tasks (midnight vote reset, hourly score recalculation). This is far below the threshold where a job queue adds value.
- **Simple migration path** — when the API scales horizontally, the cron calls can be moved to a dedicated worker service or a platform cron (Railway Cron Jobs, GitHub Actions scheduled workflow) with minimal code changes.

**Trade-off:** In-process crons don't survive crashes or restarts without re-schedule. Acceptable for Phase 1; revisit when deploying multiple API instances.

---

## Hotspot Score Recalculation: Postgres-Native (`pg_cron`) for the Live Beta (#154)

**Status:** Adopted 2026-07-29 (epic #125, live beta).

**The problem:** `hotspot_score` (and the denormalized `vote_count`) are only ever written by the hourly node-cron job above, running in-process inside the Fastify API. That API isn't deployed for this beta — Railway's trial expired and stays unpaid — so on the Supabase-native read path (see "Direct Supabase Query Path from Mobile" above) nothing recomputes the column at all. All 240 active venues sat at the `hotspot_score` column default of 0, which is a formula gap, not a "no votes yet" artifact: the formula's `externalRating * 0.1` term should put a freshly-synced, unvoted venue above 0 once anything computes it. With every score tied at 0, both Global Rankings and Explore's venue list (`order('hotspot_score' desc, name asc)`, added in #149/#150) render a stably-ordered but meaningless list.

**Chosen over:**
- **Compute-on-write inside the `cast_vote` RPC** — would only trigger recalculation on a vote, leaving the time-decay/velocity terms permanently stale between votes and unimplementable within a single-row RPC without also querying aggregate vote history. Also not this ticket's RPC to own (#126).
- **A scheduled Supabase Edge Function** — functionally equivalent to `pg_cron` here, but adds a deployable unit, cold starts, and a second place (outside the database) that has to be operated and paid for, to run a query that's naturally expressed as SQL against tables already in Postgres.

**Why `pg_cron` wins here specifically** (the general node-cron decision above stands for everything else): it runs the recalculation inside the same Postgres instance the data lives in, on the same hourly cadence as the original job, with no host to deploy or pay for — which is the exact constraint (no funded Railway) this ticket exists to work around.

**Implementation:** `apps/api/drizzle/0006_hotspot_score_pg_cron.sql` adds `public.recalculate_hotspot_scores()`, a `SECURITY DEFINER` SQL function that ports the formula documented in `apps/api/src/jobs/recalculate-scores.ts` — `score = (velocity * 0.4) + (dailyCount * 0.3) + (historicalAvg * 0.2) + (externalRating * 0.1)` — as a single set-based `UPDATE` over `venues` joined against an aggregate of `votes`. `cron.schedule('recalculate-hotspot-scores', '0 * * * *', …)` runs it hourly, matching the old job's cadence, and the migration also calls the function once immediately so the leaderboard has a non-zero baseline from the moment the migration is applied rather than waiting for the first scheduled tick. `vote_count` is untouched by this function — that column's writer is #126's `cast_vote` RPC, not this migration.

**Hardening applied (security review, #154):** a first draft of this function set `SECURITY DEFINER` with only `SET search_path = public`. Two gaps in that: (1) Postgres implicitly searches the caller's temp schema *before* any configured search_path unless `pg_temp` is listed explicitly — so any role with ordinary `TEMP` privilege (`PUBLIC` by default, including Supabase's `anon`/`authenticated`) could `CREATE TEMP TABLE votes(...)` in its own session and have the unqualified `FROM votes` in the function body resolve to attacker-controlled rows, feeding arbitrary counts into the `UPDATE venues` that runs as the function owner — full control over any venue's score, bypassing the vote cap and `votes` RLS entirely. (2) Postgres grants `EXECUTE` to `PUBLIC` by default, and Supabase auto-exposes `public`-schema functions as PostgREST RPC endpoints, so without an explicit `REVOKE`, `POST /rest/v1/rpc/recalculate_hotspot_scores` would be callable by anyone holding the (client-bundled, effectively public) anon key — independently sufficient to trigger an unbounded recalculation on demand. The shipped version pins `search_path = public, pg_temp` with `pg_temp` last (so `public.votes`/`public.venues` resolve before any temp-schema shadow), and `REVOKE EXECUTE ... FROM PUBLIC` followed by `GRANT EXECUTE` scoped to the `postgres` role the migration and `cron.schedule` are assumed to run as — unverified on this project, flagged for confirmation at apply time in the migration header.

**Deviation from a literal port:** the source comment's `externalRating` term is the raw Google rating (0-5). Multiplied directly by the 0.1 weight, that caps every unvoted venue's score at 0.5, which rounds to 0 and reproduces the exact bug this migration fixes. The ported function normalizes rating to a 0-100 scale before applying the weight (`(rating / 5.0) * 100 * 0.1`), consistent with the source comment's "scores are normalized 0-100" and giving each venue a 0-10 point baseline driven by its Google rating. `velocity`/`dailyCount`/`historicalAvg` are ported as literal, unnormalized vote counts per the source comment — with zero votes cast anywhere as of this beta, that choice doesn't affect current output; it should be revisited once real vote volume exists.

**Superseded but not removed:** `apps/api/src/jobs/recalculate-scores.ts` and its node-cron schedule are no longer the thing keeping `hotspot_score` correct in production, since the API isn't deployed. It's left in place rather than deleted — the Fastify path may return post-beta, and `apps/api/src/services/venue.service.ts`'s `recalculateHotspotScores()` is currently an empty stub that never implemented this formula in application code either way, so there's nothing to reconcile if both paths run concurrently later beyond picking one as authoritative.

**Trade-off accepted:** the scoring formula now exists only as raw SQL in a migration file, not as reusable, independently unit-testable TypeScript (contrast with the rest of the codebase's Route → Service → Repository layering). Acceptable because the Fastify service-layer implementation was never written in the first place (`recalculateHotspotScores()` is a no-op today) — this migration is the first real implementation of the formula, not a duplication of an existing one. Also unverified as of this writing: whether `pg_cron` is available on the project's Supabase plan — confirm before applying.

---

## Vote Cap + Dedup Enforced by a Postgres RPC, Not the Fastify Service (#126)

**Status:** Adopted 2026-07-30 (epic #125, live beta).

**The problem:** the 3-vote/day cap and per-venue dedup live only in `apps/api/src/services/vote.service.ts#castVote` — application-layer checks in a Fastify path that isn't deployed for this beta (same unpaid-Railway constraint as #154 above). On the Supabase-native path the mobile app writes with the client-bundled anon key; any cap enforced only in application code is bypassable by calling PostgREST's auto-generated `POST /rest/v1/votes` directly and inserting as many rows as the caller wants. The cap and dedup have to be enforced *inside the transaction* that writes the vote, which means a database-level check, not an application-tier one.

**Chosen:** `public.cast_vote(p_venue_id uuid)`, a `SECURITY DEFINER` `plpgsql` function (`apps/api/drizzle/0007_cast_vote_rpc.sql`) that reads `auth.uid()`, checks the caller's vote count for the current vote day (global per user, #62/#134 — not per-city) and whether they've already voted for this venue today, inserts the vote, and increments `venues.vote_count` — all as one atomic unit. A 4th cast (or a duplicate) is rejected with a `RAISE EXCEPTION`, not silently accepted or clamped.

**Chosen over:**

- **Application-layer enforcement only (status quo)** — this is the bug being fixed; a Fastify-only check doesn't run at all when the Fastify API isn't deployed, and even when it is, it doesn't constrain writes made through PostgREST or any other client of the same database.
- **A `CHECK` constraint or trigger on `votes`** — a `CHECK` constraint can't count sibling rows (no aggregate access), and a `BEFORE INSERT` trigger doing the same `COUNT` query the RPC does would have the identical TOCTOU race (see concurrency note below) without gaining anything over a function-based RPC, while losing the ability to shape a single structured return value (`VoteState`) for the caller in one round trip.
- **RLS policies alone** — RLS constrains *which rows* a role may see/touch, not *how many* rows exist across a caller's history; the cap is inherently a cross-row aggregate check, which is exactly what a `SECURITY DEFINER` function is for.

**Concurrency:** the cap check is a COUNT-then-INSERT, which alone is a classic TOCTOU race — two concurrent requests from the same user could both read "2 votes so far" and both insert a 3rd, breaching the cap. `cast_vote` takes `pg_advisory_xact_lock`, keyed on `(user_id, vote_day)`, before counting — this serializes concurrent casts from the *same* user without a table-level lock that would also serialize unrelated users against each other. Verified locally: 5 concurrent `cast_vote` calls from one user against 5 distinct venues yielded exactly 3 successes and 2 `NO_VOTES_REMAINING` rejections, with exactly 3 rows landing in `votes`. Per-venue duplicate votes have a second backstop independent of the advisory lock: the `votes_user_venue_date_idx` unique index (`0000_redundant_excalibur.sql`) — `cast_vote` catches `unique_violation` and re-raises it as `ALREADY_VOTED`.

**`vote_count` ownership:** 0006 (`recalculate_hotspot_scores()`) deliberately left `venues.vote_count` unmaintained, noting this RPC as its intended writer — `recalculate_hotspot_scores()` only ever *reads* `votes` to derive a score, so there's no other writer for `cast_vote` to race against.

**Error contract:** mirrors `VoteError`'s codes from `vote.service.ts` exactly (`NO_VOTES_REMAINING`, `ALREADY_VOTED`, `VENUE_NOT_FOUND`) via `RAISE EXCEPTION USING MESSAGE = '<code>', DETAIL = '<human message>'`. PostgREST surfaces `MESSAGE` as the RPC error response's `message` field verbatim, so a caller can `error.message === 'NO_VOTES_REMAINING'` — an exact-match check, the same shape the mobile client's mock-mode `VoteError` (`apps/mobile/src/api/votes.ts`) already uses, letting `useCastVote`'s `onError` branch on the real RPC and the mock path identically.

**Hardening applied (matching the #154 review findings, applied proactively here):** `search_path` pinned to `public, pg_temp` with `pg_temp` listed explicitly last, closing the same temp-table-shadowing path documented for `recalculate_hotspot_scores()` above. `EXECUTE` revoked from `PUBLIC` and granted only to `authenticated` — **not** `anon`. This is the easy-to-invert part: Supabase's `anon` role is unauthenticated traffic; both linked-account users and this beta's actual users (Supabase anonymous sign-in) carry the `authenticated` role with a real `auth.uid()` and an `is_anonymous` claim. Granting to `anon` would let unauthenticated callers vote; granting to some narrower non-anonymous subset would break voting for the beta entirely, since every current user is anonymous-sign-in. `auth.uid()` is the *only* source of voter identity — no user id is accepted as a function parameter, which would let any caller vote as anyone. Verified locally that the ACL (`REVOKE`/`GRANT`) survives a `CREATE OR REPLACE` re-run of the migration, both for `cast_vote` and for `recalculate_hotspot_scores()` (see the vote-day section below) — `pg_proc.proacl` was identical before and after re-applying `0007_cast_vote_rpc.sql`.

**Trade-off accepted:** like `recalculate_hotspot_scores()`, the cap/dedup logic now exists as raw SQL, not TypeScript — the usual Route → Service → Repository layering doesn't apply to a function that must run inside Postgres to close the bypass this ticket exists to fix. `apps/api/src/services/vote.service.ts` is left in place for the Fastify path (unexercised in this beta, same rationale as `apps/api/src/jobs/recalculate-scores.ts` in the pg_cron section above) rather than deleted or reconciled with the RPC.

**Verification:** nothing applied to the live Supabase project — the MCP connector was not authorized this session. Verified instead against a scratch local Postgres 16 with stubbed `auth.uid()`/`auth.users`/`anon`/`authenticated` roles: 3-vote cap exhaustion (4th cast rejected), duplicate-vote rejection, cap scope confirmed global rather than per-city, `vote_count` increments, the concurrent-request race (above), and ACL survival across `CREATE OR REPLACE`. Also covered by an opt-in Vitest integration suite, `apps/api/tests/db/cast-vote-rpc.test.ts` (gated on `TEST_DATABASE_URL`, skipped by default — this repo's other tests run entirely against in-memory repositories with no live database dependency).

---

## Canonical SQL Vote-Day Boundary: `public.vote_day()` (#126)

**Status:** Adopted 2026-07-30, alongside the `cast_vote` RPC above.

**The problem:** landing [Vote-Day Boundary](#vote-day-boundary-0400-city-local-nightlife-day) (#64) and [Hotspot Score Recalculation](#hotspot-score-recalculation-postgres-native-pg_cron-for-the-live-beta-154) (#154/0006) as separate tickets left two different definitions of "today" driving numbers a user sees side by side. `vote.service.ts` (and, after this ticket, `cast_vote`) buckets votes by a 04:00-America/New_York vote day. 0006's `recalculate_hotspot_scores()` bucketed its `daily_count` term by raw `CURRENT_DATE` (UTC midnight). A vote cast at 9pm ET Friday counts toward Friday's vote budget (correct) but Saturday's `hotspot_score.daily_count` (a full day early) — a 4-hour window every night (8pm–midnight ET) where the vote-remaining counter and the trending list disagree about which "today" a fresh vote belongs to. This is the same class of bug #64 fixed for the vote budget, one layer down, in the score.

**Chosen:** one canonical SQL function, `public.vote_day(at timestamptz DEFAULT now(), tz text DEFAULT 'America/New_York') RETURNS date` (`apps/api/drizzle/0007_cast_vote_rpc.sql`), used by both `cast_vote` and — via `CREATE OR REPLACE FUNCTION`, not an edit to the immutable `0006_hotspot_score_pg_cron.sql` file — `recalculate_hotspot_scores()`. Implementation: `((at AT TIME ZONE tz) - interval '4 hours')::date`. `AT TIME ZONE` resolves from the same IANA tzdata JS's `Intl.DateTimeFormat` uses (the mechanism `voteDayFor` in `packages/shared-types/src/voteDay.ts` is built on), so subtracting the cutoff hour before truncating to a date is a direct SQL equivalent of `voteDayFor`'s "local hours before 04:00 belong to the previous day" rule, without reimplementing zoned-parts arithmetic in PL/pgSQL.

**Verified TS/SQL parity:** ran both `voteDayFor` (Node, via `tsx`) and `public.vote_day()` (local Postgres 16) against the same seven instants — the 03:59:59/04:00:00/04:00:01 boundary in EDT, the same boundary on 2026-03-08 (US spring-forward day, where a fixed-UTC-offset implementation would get the hour wrong), and two instants either side of UTC midnight that must **not** roll the vote day over. All seven matched exactly. Also verified `cast_vote`'s `resetAt` (the SQL equivalent of `voteDayResetAt`) against the same instants — exact match on every case, including the DST transition.

**tz default:** `America/New_York`, matching `DEFAULT_VOTE_DAY_TIMEZONE` in `voteDay.ts` — deliberate, not a placeholder that silently diverges. The API has no per-user "currently selected city" to resolve a real per-user timezone from (no `cityId` on `users`, no city parameter on the vote endpoints — see the "Known gap" paragraph in the Vote-Day Boundary section above), and all four active cities are `America/New_York` today, so the default is behaviorally correct. A future per-city caller would pass an explicit `tz` (e.g. `c.timezone`) rather than relying on the default.

**Why not `SECURITY DEFINER`:** `vote_day()` touches no tables and carries no privilege of its own — it's pure date arithmetic over its arguments, safe for any role (including `anon`) to call directly, the same trust level as a built-in like `now()`. No `REVOKE`/`GRANT` needed, unlike `cast_vote` and `recalculate_hotspot_scores`, both of which read/write tables under elevated privilege.

**Trade-off accepted:** `recalculate_hotspot_scores()`'s `historical_avg` term (the 7-day rolling average) is also re-anchored to `vote_day(now())` rather than left on raw `CURRENT_DATE`, for internal consistency — `votes.voted_at` values are always vote-day dates now (never raw calendar dates), so anchoring the 7-day window to anything else would itself be a smaller version of the same bug. `velocity` (a rolling 60-minute window off `created_at`, a timestamptz) is untouched — it has no day-boundary concept to align.

---

## Vote-State Read Path: a `get_vote_state()` RPC, `SECURITY INVOKER` (#196)

**Status:** Adopted 2026-07-30.

**The problem:** #126 wired the vote *write* path to `cast_vote`, but the read path (`apps/mobile/src/api/votes.ts`'s `useVoteState`) still branched on `hasApi` only. In the beta's actual shape (`EXPO_PUBLIC_API_URL` unset, Supabase configured), `hasApi` is false, so every read fell through to `getMockVoteState()`, backed by AsyncStorage — votes are written to Postgres and read back from the device. A reinstall then appeared to grant a fresh daily budget while the server still held the real count, the next cast was rejected with `NO_VOTES_REMAINING` against a UI claiming votes remained, two devices on one account disagreed until each cast, and the vote-day rollover was evaluated against local storage instead of the server's boundary.

**Chosen over a client-side `SELECT` against `votes` under RLS:** a companion RPC keeps the vote-day boundary (#64) computed in exactly one place, `public.vote_day()`, instead of reimplementing it client-side against device local time (the same class of drift #64 and the vote-day section above both exist to prevent), and it returns the identical `VoteState` shape `cast_vote` already returns, so the mobile client parses one shape regardless of which call produced it.

**`SECURITY INVOKER`, not `SECURITY DEFINER`:** `cast_vote` needs definer privilege because it writes past RLS's insert-nothing posture for `authenticated` on `votes`. A read of the caller's *own* votes needs no such escalation — `0002_rls_policies.sql`'s existing `"votes: read own"` policy (`USING (auth.uid() = user_id)`) already restricts a plain `SELECT` run as `authenticated` to exactly the caller's own rows, and Supabase's default schema grants already give `authenticated` table-level `SELECT` on `votes` (the same default `cities`/`venues`'s public-read policies rely on). Defaulting to `SECURITY DEFINER` by copying `cast_vote`'s shape would grant this function elevated privilege it has no use for and every reason not to hold. `get_vote_state` keeps an explicit `WHERE user_id = auth.uid()` anyway, belt-and-suspenders, same as `cast_vote`'s own defensive re-checks — but the isolation guarantee comes from RLS, not that filter.

**No duplicated `resetAt`/`maxVotes`:** `cast_vote` (0007) computed `v_reset_at` inline and declared the 3-vote cap as a local constant. Reimplementing either in `get_vote_state` would risk the same two-implementations drift `public.vote_day()` was introduced to eliminate for the vote-day boundary itself. `apps/api/drizzle/0008_get_vote_state_rpc.sql` extracts `public.vote_max_daily_votes()` (returns `3`) and `public.vote_reset_at(at, tz)` (built on `vote_day()`: the next vote day's 04:00-`tz` cutoff, as an instant) and re-points `cast_vote` at both via `CREATE OR REPLACE` — `0007_cast_vote_rpc.sql` itself stays immutable, same pattern 0007 used to re-point 0006's `recalculate_hotspot_scores()`. Neither helper needs `SECURITY DEFINER`/`REVOKE`/`GRANT`: both are pure functions of their arguments (via `vote_day()`, itself privilege-free) with no table access.

**Grants:** `EXECUTE` revoked from `PUBLIC` and granted only to `authenticated` — not `anon`. Same reasoning as `cast_vote`: Supabase's `anon` role is unauthenticated PostgREST traffic, while both linked-account users and this beta's Supabase anonymous-sign-in users carry `authenticated` with a real `auth.uid()`. `auth.uid()` is the only source of identity — no user-id parameter, which would let any caller read anyone's vote state. A caller with zero votes today gets a well-formed full-budget state (`remainingVotes = maxVotes`, `votedVenueIds = []`), not null or an error — there's no row to be missing; the aggregate over zero matching rows already has that shape.

**Verification:** nothing applied to the live Supabase project — the MCP connector was not authorized this session. Verified against a scratch local Postgres 16, with RLS enabled and the same `"votes: read own"` policy as `0002_rls_policies.sql` added to the test schema (not otherwise applied by `apps/api/tests/db/cast-vote-rpc.test.ts`, which only exercises 0006/0007/0008's own functions) — zero-votes-today returns a full budget, today's votes are reflected in `remainingVotes`/`votedVenueIds`, a vote inserted on a previous vote day is excluded, `resetAt` matches `cast_vote`'s for the same instant, an unauthenticated call is rejected with `AUTH_REQUIRED`, and `anon` is denied `EXECUTE` outright. All 26 pre-existing `cast_vote` tests still pass after the shared-helper re-point, confirming no behavior change. Added to the existing suite rather than a sibling test file, to avoid two files racing to `DROP`/`CREATE` the same unnamespaced `public.votes`/`venues`/`users` objects under Vitest's default file-parallel execution.

**Scope:** this ticket ships the RPC only. Re-pointing `apps/mobile/src/api/votes.ts`'s `useVoteState` at it (replacing the `hasApi`-only branch) is mobile-engineer follow-up work, out of scope here.

---

## Deployment Target: Railway (planned)

**Chosen over:** Render, Fly.io, AWS ECS, Vercel, Supabase Edge Functions

**Why:**
- **Simplest DX** — Railway deploys from GitHub on merge to `main`. No Kubernetes, no IAM, no YAML manifests.
- **Integrated addons** — Postgres and Redis are Railway services that can be attached to the API with one click. `DATABASE_URL` and `REDIS_URL` are injected automatically.
- **PostGIS support** — Railway's Postgres service supports the PostGIS extension out of the box.
- **Pay-per-use** — billed by actual CPU/memory usage, not reserved capacity. Zero idle cost.
- **Container support** — the Dockerfile builds a production image that Railway can deploy directly, enabling future migration to Fly.io or AWS without application changes.

**Trade-off:** Less control than AWS. No egress to private VPCs. Acceptable for a startup-stage product; migrate to AWS ECS or Fly.io when Railway's limits are hit.

**Status:** Not yet configured. Steps:
1. Create Railway project at railway.app.
2. Add PostgreSQL and Redis services.
3. Connect GitHub repo and set deploy environment to `main`.
4. Set environment variables in Railway dashboard.
5. Uncomment the deploy step in `.github/workflows/api-deploy.yml`.

## Two-Secret JWT via `@fastify/jwt` Namespaces

**Chosen over:** single-secret JWT, signing refresh tokens with a separate library (`jsonwebtoken`, raw `fast-jwt`), or encoding the access/refresh distinction only in the payload.

**Why:**
- Access and refresh tokens are signed with **different secrets** (`JWT_SECRET` vs `JWT_REFRESH_SECRET`) so that a leak of the access secret — which is present in many more code paths — does not let an attacker mint refresh tokens.
- `@fastify/jwt`'s `namespace` option registers a second plugin instance under `fastify.jwt.refresh`, giving its own `sign()` / `verify()` with an independent secret. This keeps all JWT logic inside one battle-tested plugin instead of introducing a second signing library.
- In v10 of `@fastify/jwt`, per-call `{ secret }` overrides on `sign` / `verify` were removed, so a single-registration approach with two secrets is no longer possible — namespacing is the supported path.

**Trade-off:** Two JWT instances mean two plugin registrations and a module augmentation (`interface JWT { refresh: JWT }`) so TypeScript sees `fastify.jwt.refresh`. The extra ~10 lines are the cost of keeping the security boundary between access and refresh tokens.

**Version note:** `@fastify/jwt` was upgraded from `^9.1.0` to `^10.0.0` in this change to resolve critical CVEs in `fast-jwt` (algorithm confusion — GHSA-mvf2-f6gm-w987 CVSS 9.1; cacheKey collision identity mixup — GHSA-rp9m-7r4c-75qg CVSS 9.1). Staying on v9 is not an option.

---

## Independent Semver per Service via Changesets

**Chosen over:** lockstep repo-wide tags (`vX.Y.Z` covers everything), or hand-maintained per-service version bumps.

Mobile and API ship on different cadences. Lockstep tags would force the API to bump every time the mobile app shipped — polluting the API's changelog and giving the impression of API releases that never actually happened. Independent tags (`mobile-vX.Y.Z`, `api-vX.Y.Z`, `shared-types-vX.Y.Z`) reflect what actually changed.

**Why Changesets:**

- **Aggregation across PRs.** Many small PRs land between releases; Changesets batches the version bumps into one "Version Packages" PR rather than mid-PR conflicts on `package.json`.
- **Per-package bump granularity.** A single change can describe `mobile: minor, api: patch` in one file.
- **Auto-generated CHANGELOG.md per package.** Each `apps/*/CHANGELOG.md` is appended to from the consumed changesets — no hand-maintained changelog drift.
- **No publishing.** All Crawl packages are `private: true`. Changesets is used purely for version bookkeeping; the actual deploy is dispatched separately.

**Trade-off:** One extra step in the contributor workflow (`npm run changeset` after a feature change). Documented in `.changeset/README.md`.

---

## Dispatch-Gated Releases

**Chosen over:** auto-deploy on tag push, or auto-deploy on merge to `main`.

Both `release-mobile.yml` and `release-api.yml` are `workflow_dispatch`-only. Tag pushes alone do not deploy. Two reasons:

- **Human gate before reaching users.** Even after tests pass and a maintainer has approved the PR, the act of dispatching a release is an explicit decision — "yes, this version is ready to be on real devices." This is especially important for OTA, where a bad bundle reaches every user within minutes.
- **Decouples versioning from release timing.** A maintainer can merge several features that bump versions, then choose when to actually cut a release. This avoids the failure mode where a routine merge accidentally triggers an unintended store submission.

For production, a second gate is enforced by the `production` GitHub Environment with required reviewers — even after the dispatch, a designated reviewer must approve the deploy job.

**Trade-off:** Releases are not zero-touch. Acceptable; the extra 30 seconds per release is the cost of not breaking production by accident.

---

## Trunk-Based Development with Tag-Triggered Releases

**Status:** Adopted 2026-07-27 (supersedes the dispatch-gated release model).

**Chosen over:**
1. **Release branches + dispatch-triggered releases** — the previous model, where `release/vX.Y.Z` branches were cut from `main`, ticket PRs merged into the release branch, and workflows computed version bumps on dispatch.
2. **Repo-wide `vX.Y.Z` tags** — a single lock-step tag covering all services (alternative to per-service `api-v*` / `mobile-v*` tags).

**Why this approach won:**

The release-branch model created a **second integration point and a second version-bump mechanism** that could silently diverge. Changesets lived on `main` and bumped versions there; release-branch workflows also bumped versions (via `npm version`) and pushed tags. If a Changesets PR landed on `main` between release branches, the release workflow's `npm version` bump could land on top of it, double-bumping or stepping on the version the Changesets PR set.

Collapsing to trunk-based + tag-triggered makes **Changesets the sole, authoritative version bumper.** A human merges the Changesets "Version Packages" PR on `main`, versions are bumped once, and then a human pushes a git tag at that commit. The tag alone triggers the release; the release workflows never run `npm version` or push commits — they parse the tag, validate it against `package.json` (fail loudly if it doesn't match), and build the artifact. This eliminates the double-bump conflict entirely.

**Why not repo-wide tags:** Mobile and API ship on independent cadences and maintain independent semver lines. A single `vX.Y.Z` tag would force them into lock-step releases — the API would bump every time the mobile app shipped, polluting the API changelog with non-releases. Per-service tags (`mobile-vX.Y.Z`, `api-vX.Y.Z`) reflect what actually changed. The complexity cost (slightly longer tag names) is negligible vs. the clarity win (independent changelogs, independent release cadences).

**Trade-offs accepted:**

- **Hand-authored tag format.** Releases now depend on a correctly-formatted git tag (`api-v1.2.3`, `mobile-v1.2.3-ota.<timestamp>`). Mitigated by the `resolve` job in each release workflow (parse the tag with a strict regex, fail with `::error::` + non-zero exit if it doesn't match) and the version-consistency guard (cross-check the tag's semver against the tagged commit's `package.json` / `app.json`). A tag that doesn't parse is unshippable; a tag that parses but doesn't match the versioned commit is also caught.
- **Main must always be releasable.** There is no holding area for in-progress work anymore. Ticket branches PR directly into `main` and merge there. The trade-off is acceptable because (a) PR reviews ensure code quality before merge, (b) the staging-build automation on every `main` push gives immediate signal if something is broken, (c) if a bad merge lands, a hot-fix branch off `main` + quick PR + tag re-cuts a fresh release.

**Implementation surface:** See `docs/ops/CICD_PIPELINE.md` for the full pipeline, tag grammar, and release procedures.

---

## Fingerprint Runtime Version for OTA

**Chosen over:** `runtimeVersion: { policy: "appVersion" }` or `"sdkVersion"`, or a hand-maintained string.

`appVersion` and `sdkVersion` policies require the engineer to remember when to bump the runtime — and "remembering" is exactly the failure mode that ships an OTA bundle to a binary that lacks the required native code, causing crashes.

`policy: "fingerprint"` (set in `apps/mobile/app.json`) computes a hash over the project's native dependencies. The runtime version becomes a property of what was actually built. EAS Update only delivers an OTA bundle to a binary whose runtime version matches — so a JS bundle built after a `react-native-maps` upgrade simply does not reach binaries built before that upgrade. The CI fingerprint job in `ci.yml` surfaces these changes during PR review.

**Trade-off:** Slightly opaque — engineers can't read the runtime version off a config file, they have to ask Expo. Acceptable, because the alternative is silent OTA-induced crashes.

---

## Direct Supabase Query Path from Mobile (Re-Added for Live Beta)

**Status:** Re-adopted 2026-07-16 (epic #125, v1.1.0 live-data cutover).

The three-tier fallback hierarchy for reads is: (1) `hasApi` → call Railway API; (2) `hasSupabase` → query Supabase directly with published anon key + RLS; (3) fallback to bundled mock data. The Supabase branch was temporarily retired while `apps/api` matured, but is now re-added for the first live beta (pre-Railway launch) to enable testing venue data on a real database without paying for Railway hosting.

**Why re-adopted for live beta:** The team chose to launch the initial live beta natively on Supabase (no API intermediary) to reduce operational overhead and costs before ramping up to the full Railway + Fastify stack. Users test against real seeded venue data, voting persists to the real backend, and filter behavior is identical to the eventual production path (both use the same `filterVenues()` predicate logic client-side).

**Implementation:** the tier is resolved **once**, as `dataSource` in `src/lib/env.ts` (`'api' | 'supabase' | 'mock'`), and `src/api/venues.ts`, `src/api/cities.ts`, and `src/api/trending.ts` branch on that single value. Supabase reads use explicit column selects (security + bandwidth) shared via `src/api/venueRow.ts`, `.eq('is_active', true)`, `.eq('city_id', …)`, `.order('hotspot_score' desc)` with `name` as a tiebreak, and apply the same filter predicates as mocks (client-side via `filterVenues`). RLS policies on the `venues` and `cities` tables permit public read.

**Why one shared `dataSource` rather than per-hook checks:** each hook originally re-derived its own ladder from `hasApi`/`hasSupabase`, and `useTrending` never got the Supabase rung. Because staging deliberately leaves `EXPO_PUBLIC_API_URL` unset, that hook fell straight through to bundled mock data — Global Rankings rendered fabricated venues and vote counts as live rankings for the whole v1.1.0 beta, with no signal to the user (#150). A single derived tier makes that class of drift unrepresentable.

**Trade-off accepted:** two long-term read paths maintained until the API path is primary again (expected post-beta when Railway goes live). The paths are parallel branches, not an abstraction layer, so switching between them is a compile-time env var toggle.

---

## Historical: Direct Supabase Query Path (Original Rationale)

<details>
<summary>Why the path was initially explored</summary>

While the Fastify API was being built out, a temporary Supabase-direct branch unblocked end-to-end testing on real data without API dependencies. The three-tier fallback hierarchy (`EXPO_PUBLIC_API_URL` → Supabase → mock) meant the app could ship with real data before the backend was production-ready, and Supabase Row Level Security policies provided the trust boundary for public reads.

</details>

---

## Anonymous-First Auth via Supabase

**Chosen over:** mandatory account creation up front, email/password signup, Clerk/Auth0, or a bespoke JWT flow against `apps/api`.

The mobile app's first-launch experience is anonymous-first. On boot the app checks AsyncStorage for an existing Supabase session; if none exists, it calls `supabase.auth.signInAnonymously()` and persists the session via the AsyncStorage adapter configured on the Supabase client. The user is immediately authenticated as an anonymous user and can use every feature that doesn't require a verified identity.

**Why anonymous-first:**

- **Zero-friction first run.** A user who just installed the app is one tap from the explore map. No email, no password, no "verify your inbox" loop. This is the single biggest conversion lever on a discovery app.
- **Stable identity for votes from minute one.** Every anonymous user has a real Supabase UUID. Votes, filters, and any user-scoped data can be persisted server-side without waiting for an explicit signup.
- **Transparent upgrade path.** When the user later taps "Continue with Apple" or "Continue with Google", supabase-js (v2.43+) calls `signInWithIdToken` against the existing anonymous session, which **upgrades the same user record in place** rather than creating a new one. The UUID is preserved, so all prior votes/preferences remain attached. No data migration step.

**Why Apple + Google (and not email/password):**

- **Native id_token flows are the lowest-friction third-party path on mobile.** `expo-apple-authentication` and `@react-native-google-signin/google-signin` both surface OS-level sheets — no in-app browser, no password.
- **App Store rule 4.8** requires Sign in with Apple whenever any third-party login is offered on iOS. Apple is therefore non-negotiable on iOS; the iOS UI hides the Apple button on Android (`Platform.OS !== 'ios'` check) where Apple Sign-In has no native UX worth supporting.
- **Email/password adds liability without value here.** Crawl is not a productivity tool where users juggle credentials; the upgrade path from anon to authed via OS providers is sufficient.

**Trade-off — reinstall resets the anonymous identity.** AsyncStorage is wiped when the user uninstalls the app, so a reinstalled-but-never-linked user gets a fresh anonymous UUID. This is the explicit reason the linking flow exists: any user who values continuity across reinstalls is one tap from a permanent Apple/Google identity. Documented to the user via the auth-screen copy ("Sign in to keep your votes and preferences across devices").

**Trade-off — Expo Go cannot exercise Apple/Google.** Both native modules are absent from Expo Go's Android/iOS runtime. The auth helpers therefore `require()` the native modules lazily inside `try/catch`, so the app boots and the anonymous path remains usable even in Expo Go. Real auth requires a development build or production binary.

**Implementation surface:**

- `src/lib/supabase.ts` — Supabase client, `auth.storage = AsyncStorage`, `persistSession: true`.
- `src/lib/auth.ts` — `ensureSignedIn()`, `signInWithApple()`, `signInWithGoogle()`, `signOut()`.
- `src/context/AuthContext.tsx` — exposes `user`, `isAnonymous`, `userLocation`, `linkApple`, `linkGoogle`, `signOut`. Subscribes to `supabase.auth.onAuthStateChange`.
- `app/(onboarding)/` — three screens (`index`, `location`, `auth`) that run only on first launch, gated by `crawl.firstLaunchComplete.v1` in AsyncStorage.
- `app/_layout.tsx` — `OnboardingGate` reads two signals (the flag and a Supabase session read) and emits `<Redirect href="/(onboarding)" />` until either signal confirms onboarding is done. See `src/lib/onboarding.ts` for the two-signal decision logic (#158).

**Required external configuration (one-time):**

1. **Supabase dashboard** — enable the Apple and Google providers under Authentication → Providers. Paste the iOS bundle id and the Google Web client ID into the relevant Supabase fields.
2. **Apple Developer** — create a Services ID for "Sign in with Apple" and tie it to the iOS bundle id. The id_token Supabase verifies is signed by Apple against this configuration.
3. **Google Cloud Console** — create OAuth 2.0 client IDs of type "iOS" and "Web application". Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env`. Paste the reversed iOS client ID into `apps/mobile/app.json` under the `@react-native-google-signin/google-signin` plugin's `iosUrlScheme`.

---

## Dynamic Venue Filtering Strategy

**Chosen over:** materialized views, per-filter Postgres views, hard-coded SQL functions, client-side filtering.

The map screen scopes by city and applies an arbitrary subset of ten filter chips on top. The constraint is "fastest correct path" with vote counts changing every few seconds — so anything precomputed (materialized views, denormalized aggregates that aren't already there) is the wrong shape.

**The approach:**

1. **Compose `WHERE` predicates dynamically in the Supabase query.** `useVenues(city, filters)` chains `.eq('city', ...)`, `.eq('is_trending', true)`, `.eq('is_open', true)`, and `.contains('highlights', tags)` only for the filters that are active. PostgREST handles this composition; Supabase's planner picks the right index per predicate combination.
2. **Index for the predicates, not for arbitrary queries.** Migration `0001_venue_filter_indexes.sql` adds compound `(city, is_active)`, `(city, is_trending) WHERE is_trending`, `(city, is_open) WHERE is_open`, plus a GIN on `highlights[]`. Each filter chip therefore hits a leading-column index. The partial indexes (`WHERE is_trending`) are tiny because most rows fail the predicate.
3. **Stable queryKey sorting.** `venueKeys.list(city, filters)` sorts the filter array before keying so `['trending', 'open-now']` and `['open-now', 'trending']` share a cache entry. Without this, every re-ordering would cause an unnecessary refetch.
4. **No materialized views.** Vote counts and `hotspot_score` change continuously; a materialized view would be stale within seconds and the refresh cost would be wasted.
5. **No regular views either, for now.** Predicates compose well enough with `WHERE` clauses that a view layer adds indirection without speeding anything up. Views become useful when filter logic involves joins or aggregates the planner can't see through — flag for follow-up if a "trending tonight" filter starts requiring a vote-count-by-day join.
6. **PostGIS RPC reserved for spatial filters.** No spatial chip exists in the current set, so no `venues_within(...)` function was added. When one is added, follow this pattern: a `language sql stable` function fronted by Supabase RPC, with a GiST index on the geography column. Avoid encoding spatial logic into the JS client — the round-trip math is fine in JS but the server-side index lookup isn't replicable client-side.

**Filter → predicate mapping** (in `apps/mobile/src/api/venues.ts`):

| Filter id          | Predicate                                |
| ------------------ | ---------------------------------------- |
| `trending`         | `is_trending = true`                     |
| `open-now`         | `is_open = true` (note: see schema TODO — should derive from `hours`) |
| `live-music`       | `'live-music' = ANY(highlights)`         |
| `happy-hour`       | `'happy-hour' = ANY(highlights)`         |
| `rooftop`          | `'rooftop' = ANY(highlights)`            |
| `craft-cocktails`  | `'craft-cocktails' = ANY(highlights)`    |
| `dive-bar`         | `'dive-bar' = ANY(highlights)`           |
| `sports`           | `'sports' = ANY(highlights)`             |
| `dancing`          | `'dancing' = ANY(highlights)`            |
| `outdoor`          | `'outdoor' = ANY(highlights)`            |

The highlight tag values must match what the venue sync job writes to the `highlights[]` column. If the sync job uses different casing or punctuation, update the `HIGHLIGHT_TAGS` map in `venues.ts` rather than per-call mapping.

**Trade-off:** Dynamic predicate composition is harder to reason about than a fixed view because the SQL the planner sees varies by call. Mitigated by: (a) the index plan is deterministic per active filter set, (b) we only compose well-known predicates, (c) every active predicate has a leading-column index. Acceptable for this size of query.

---

## City as Source of Truth in VenueContext

**Chosen over:** independent city state per screen, deriving city from a route param, or storing only a city `id` UUID.

VenueContext now seeds `selectedCity` from the user's onboarding-captured location:

1. `useCities()` resolves the list of supported cities once.
2. `findNearestCity(cities, userLocation, maxMiles=50)` picks the closest covered city via haversine.
3. The result is set into `selectedCity` once on first run; manual selection via `setSelectedCity` flips a guard ref so seeding never overrides a user choice.
4. If the user is more than 50 miles from any covered city, the previous fallback (`Austin, TX`) wins — better than zooming the map to the wrong city.

**Why the context still stores the display string, but queries no longer match on it:**

`selectedCity` remains a `"Name, State"` display string — it is what the CitySelector renders, what query keys are scoped by, and what the vote cache is keyed on. But **venue queries filter on `venues.city_id`**, resolved through `resolveCityId()` in `src/api/cities.ts`.

This section previously documented the opposite: queries keyed off the denormalized `venues.city` text column, with the caveat that "the display string format must stay consistent across `cities.name + ', ' + cities.state` and `venues.city`. The seed and sync jobs currently produce this format."

**That caveat was wrong about the sync job, and it shipped.** `apps/api/src/db/seed.ts` writes `'Charlotte, NC'`, but the Google Places sync job writes `city: ctx.cityName` — the bare `--city` argument, `'Charlotte'`. Every venue in the live database came from the sync job, so `.eq('city', 'Charlotte, NC')` matched **zero rows for all four cities** and the entire Explore tab shipped empty in v1.1.0 (#149).

**Why `city_id` won:** the FK is already populated on all 240 live rows and indexed (`venues_city_id_idx`), so the switch needed no migration and no backfill — only the client change the original decision had already anticipated ("swap to UUID in one place"). A denormalized string that two writers format differently has no single source of truth; the FK does, by construction.

**Trade-off accepted:** one extra resolution step between "user picked a city" and "query the venues table." It costs no extra round-trip in practice (it reads the same 1-hour-cached `cities` query `useCities()` already populates), but it does mean venue reads now fail loudly when a display name has no matching `cities` row, instead of silently returning nothing. That is the intended direction — the silent-empty behavior is what hid this bug for an entire release.

`venues.city` is now unread by the mobile client and remains slated for removal in the #76 migration wave. The Fastify repository still matches it with `ILIKE '%city%'` (`drizzle-venue.repository.ts`) and is broken against sync-written rows for the same reason; that path is unexercised while Railway is unpaid and is tracked in #149.

---

## Loading and Error UI

**Chosen over:** ad-hoc per-screen spinners, blocking modals on failure, no offline indicator, custom skeletons per surface.

Every data-driven screen renders one of three states based on the underlying TanStack Query: skeleton (no cached data, fetch in flight), error fallback (query failed), or empty (query succeeded with zero results). The previous code silently rendered an empty list whenever a fetch failed.

**Primitives** (in `components/ui/`):

- **`Skeleton`** — a single component sized via NativeWind classes (`<Skeleton className="h-4 w-32 rounded" />`). One Reanimated 3 opacity loop drives the pulse on the UI thread. No per-screen variants — every skeleton block is this one component, and per-surface "shapes" (e.g. `VenueCardSkeleton`) are just compositions of `Skeleton`s arranged to match the loaded silhouette. This rule keeps the visual language consistent and means tweaking the pulse is one file, not twelve.
- **`ErrorState`** — title + message + optional retry button. Used whenever `isError` is true on a query. Always offers a retry path when one is provided.
- **`EmptyState`** — same shape as `ErrorState` but for the "succeeded with zero results" case (e.g. filters exclude every venue). Distinct semantically: no failure occurred, so the language and CTA differ.

**`isLoading` semantics — skeleton only when no cached data exists.** TanStack Query's `isLoading` is true on the *first* fetch with no cache; once the city or filter set has been seen before, switching back uses cache while a refetch happens in the background. Skeletons therefore only appear on the cold path; subsequent toggles show stale data immediately. This matches user intuition (instant response on familiar choices) and avoids skeleton flicker on every chip toggle.

**Loading/error are lifted out of `VenueContext`.** The provider exposes `isVenuesLoading`, `isVenuesError`, and `refetchVenues` so screens never have to call `useVenues` again to read its status. One source of truth, no double-subscription.

**Connectivity banner over a blocking modal.** A non-blocking `OfflineBanner` (under the status bar, red background) appears when `@react-native-community/netinfo` reports `isInternetReachable === false`. It does NOT block the UI — TanStack Query's cache continues to serve stale results, and queries fail gracefully on their own. The banner is signal, not a gate. Modal-style "you're offline" overlays are user-hostile when a cached experience would still be usable; this is the lighter touch.

**NetInfo as a lazy require.** The banner imports netinfo via `try { require(...) }` so the module's absence (Expo Go without a dev client, or before the package is installed) makes the banner a no-op rather than crashing the app at module load.

**Trade-off:** Three states per screen is more wiring than a single spinner. Mitigated by the shared primitives — each screen adds ~10 lines of conditional rendering, not custom UI. Accepted as the cost of failing gracefully.

---

## Agent Team Orchestration: Skill Orchestrator over Nested Agents

**Chosen over:** a scrum-master *subagent* that spawns worker subagents; external orchestration frameworks; a flat "one Claude does everything" workflow.

The agent team (see [Agent Team Charter](../claude/AGENT_TEAM.md)) pairs specialized worker agents (`.claude/agents/*.md` — mobile-engineer, qa-engineer, docs-writer, code-reviewer) with a scrum-master **skill** (`.claude/skills/scrum/SKILL.md`) that the main session executes.

**Why the orchestrator is a skill, not an agent:**

- **Hard constraint:** Claude Code subagents cannot spawn subagents. A scrum-master agent could plan assignments but never dispatch them — every dispatch would bounce back to the main session anyway. Making the orchestrator a skill removes the pointless hop.
- **The main session already holds the context** (sprint plan, issue history, user preferences, git state) that assignment decisions need. A subagent would start cold and re-derive all of it.
- **Approval stays with the user.** The skill runs in the main loop, so assignment confirmation, ambiguity escalation, and destructive-action gates use the normal conversation — a nested orchestrator would bury those decisions.

**Why scoped worker agents instead of one generalist:**

- Tool scoping enforces role boundaries mechanically (code-reviewer is read-only; docs-writer can only run read-only git), not just by convention.
- Independent verification: the qa-engineer and code-reviewer check the mobile-engineer's work without sharing its context or its blind spots.
- Cheap right-sizing: docs-writer runs on haiku; implementation roles inherit the session model.

**Why not an external orchestration framework:** GitHub Issues + the sprint plan doc are already the shared state; the Agent tool is already the dispatch mechanism. Adding LangGraph/CrewAI-style machinery would duplicate both.

**Trade-offs accepted:** workers start cold, so every dispatch brief must restate the ticket (root cause, criteria, branch) — more prompt overhead per ticket. Orchestration is serialized through one main session rather than a true concurrent swarm; parallelism is limited to independent tickets in isolated worktrees. Both are acceptable at current team size (one human + agents).

---

## Animated Splash via JS Overlay (`AnimatedSplash`)

**Chosen over:** static-only native splash, a Lottie/video splash, regenerating `splash.png` with the logo baked in, or `expo-splash-screen`'s built-in fade.

The cold-launch brand moment is a JS overlay (`components/layout/AnimatedSplash.tsx`) layered on top of the navigator, not a richer native asset. The native static frame (`assets/splash.png` on `#0a0a0f`) stays minimal; `_layout.tsx` keeps `preventAutoHideAsync`, calls `hideAsync` once fonts load as before, and mounts the overlay in the same render so the JS layer takes over with zero gap (same background color on both sides of the handoff). The overlay owns its dismissal: it fades itself out and calls `onAnimationComplete`, which flips `splashAnimationComplete` and unmounts it.

**Why an overlay:** it keeps the animation in the JS/Reanimated world the rest of the app already uses (no Lottie dependency, no native splash regeneration, no raster export pipeline), and the martini-pin mark renders from the same `assets/brand/*.svg` vectors as everywhere else via `SvgXml` — no `.svg`-file metro transformer added.

**Motion budget.** Entrance (fade + 0.92→1 scale-settle, 600ms) overlaps app/font load; only the ~350ms hold-plus-exit is pure added latency, keeping total under the ~1s target. `ReduceMotion.System` on each timing makes the OS reduce-motion setting collapse the animation automatically.

**Trade-offs accepted:** the very first native frame is still the plain static splash (no animation until JS is up), and the SVG markup is inlined as strings in the component rather than imported from the asset files (the cost of having no svg-file transformer). Both are minor and avoid heavier tooling.

## Explore Bottom Sheet: Custom `PanResponder` over a Native Sheet Library

**Chosen over:** `@gorhom/bottom-sheet` (+ `react-native-gesture-handler`), the de-facto standard sheet.

The Explore venue list is a drag-to-collapse bottom sheet (`components/venue/VenueSheet.tsx`) layered over a full-height map, built on React Native's built-in `PanResponder` + `Animated` — **not** a native gesture library.

**Why.** The whole v1.1.0 reskin line is kept OTA-deliverable (JS-only, shipped via EAS Update on the existing binary). `@gorhom/bottom-sheet` pulls in `react-native-gesture-handler`, a **native module** requiring `GestureHandlerRootView` and a new native build — which would force this change out of the OTA channel and into a binary release. `PanResponder` + `Animated` are core RN, so the sheet ships as an over-the-air update.

**How it works.** The content area is measured via `onLayout`; the sheet is an absolutely-positioned `Animated.View` (height = container) translated between two snap points — collapsed peek (`containerHeight - PEEK_HEIGHT`) and expanded (`TOP_GAP`, so the map never fully disappears). Only the **header handle** is wired to the `PanResponder`, so the map's pan/zoom and the list's scroll never fight the sheet drag. Release snaps to the nearer point, biased by fling velocity.

**Trade-offs accepted:** hand-rolled gesture physics are less polished than gorhom's, and only the handle collapses the sheet (pulling down at the top of the scrolled list does not) — the deliberate cost of staying OTA-safe. If a native binary is being cut anyway, revisiting gorhom is reasonable.

---

## Global Vote Budget (Not Per-City)

**Decided:** 2026-07-16 for v1.1.0

**Chosen:** Single 3-vote budget per user per day, shared across all cities. Casting a vote in any city decrements the global count; switching cities does not reset the budget.

**Alternatives:** Per-city budgets (3 votes per city per day independently), or per-role budgets (different limits for anonymous vs. linked users).

**Why:** Simpler mental model for users. "I have 3 votes today" is clearer than "3 per city" when they're exploring multiple cities in a single session. Prevents vote-splitting abuse (casting all 3 in the lowest-activity city to game rankings). Aligns with the server's `vote.service.ts` implementation, which enforces a global budget.

**Trade-offs accepted:** Users exploring multiple cities must budget their 3 votes across them. This is intentional — it encourages voting for venues they truly think are hottest, not just voting in every city they look at.

**Implementation:** `src/api/voteStorage.ts` persists vote state (date + global remaining count + list of voted venue IDs) to AsyncStorage, keyed by today's date. `voteKeys.states()` is a shared prefix for queryKey invalidation so all city-scoped `state(city)` cache entries update in lockstep after a cast/removal (one vote affects all cities' budgets). See [Global Vote Budget](./DESIGN_DECISIONS.md#global-vote-budget-not-per-city) (this section) and [Scoped Query Keys with Shared Prefixes](./DESIGN_DECISIONS.md#global-vote-budget-not-per-city) for cache invalidation patterns.

---

## Vote-Day Boundary (04:00 City-Local "Nightlife Day")

**Decided:** 2026-07-28 (timezone basis) / 2026-07-30 (04:00 cutoff hour confirmed), implemented in ticket #64.

**Chosen:** Votes reset at 04:00 in the timezone of the relevant city (`public.cities.timezone`), not at UTC midnight and not at the previously-proposed fixed 5am. Vote day *D* runs 04:00 local on *D* through 03:59:59 local on *D+1* — a venue visit at 01:00 Saturday counts toward Friday night, and rollover lands after last call rather than mid-evening. Implemented once, canonically, in `packages/shared-types/src/voteDay.ts` (`voteDayFor`, `voteDayResetAt`) so the API, the mobile mock store, and the mobile countdown can't drift apart again the way `vote.service.ts`'s raw-UTC `today()` and `voteStorage.ts`'s `todayKey()` had.

**Alternatives:** UTC midnight (the pre-#64 bug — resets at 7-8pm ET, mid-evening); a fixed 5am-local-nightlife-day boundary (the original proposal in this section, superseded — 4am was chosen instead per repo-owner sign-off, no material difference in mechanism, just the hour); true per-user local time inferred from device/location (rejected — would require tracking a `users.timezone` or per-request location on every vote call, and the whole point of a shared *city* timezone is that everyone at the same venue reset together, not on N different personal clocks).

**Which city's timezone governs a given user's vote day (sub-decision):** the cap is global per user (#62/#134) but the boundary is inherently per-city, so a user active across cities in different timezones could otherwise see two different "todays" under one global budget. Resolved by deriving vote day from the user's **currently-selected city**, not per-venue — a single user has exactly one vote day at any moment, consistent across every venue they're looking at. Per-venue derivation was rejected as incoherent with a global cap (the same user could simultaneously be in two different "todays" depending which venue's vote they're checking).

**This is behaviorally moot today:** all four active cities (Charlotte NC, South End Charlotte NC, Sayville NY, Patchogue NY) are `America/New_York`, so every user has the same vote day regardless of which is "selected." The first scenario that would exercise the distinction: a fifth city ships in a different timezone (e.g. a Central- or Pacific-time market) and a user who voted while their selected city was that new market then switches their selected city to an Eastern one (or vice versa) before the next boundary — at that point the resolved vote day could shift under them mid-session if the two cities' 04:00 boundaries don't coincide in UTC.

**Known gap:** the API does not yet track a per-user "currently selected city" (no `cityId` on `users`, no city parameter on the vote endpoints) — `apps/api/src/services/vote.service.ts` currently resolves every user's vote day against the shared `DEFAULT_VOTE_DAY_TIMEZONE` constant (`America/New_York`) rather than a per-user lookup. This is a deliberate placeholder, correct today because of the single-timezone fact above, not a silent divergence from the "selected city" decision — wiring an actual per-user city resolution is follow-up work gated on the first non-Eastern city shipping.

**Trade-offs accepted:** the vote-reset cron (`apps/api/src/jobs/reset-votes.ts`) now fires at `04:00 America/New_York` instead of `00:00 UTC` to stay aligned with the same boundary — a fixed UTC cron time would otherwise have zeroed venue vote counts mid-vote-day again, reintroducing the ticket's own symptom one layer down. The boundary computation uses `Intl.DateTimeFormat` with an explicit IANA `timeZone` (a two-pass zoned-time conversion, verified across the 2026 spring-forward and fall-back transitions) rather than a hand-rolled fixed offset, so it stays correct across DST without a new dependency — at the cost of a few dozen lines of offset-resolution logic instead of a one-line UTC-offset subtraction.

## Cutover & Rollout Control (Compile-Time Env Flags)

**Decided:** 2026-07-16 for v1.1.0 and beyond

**Chosen:** Feature control via compile-time environment variables (`hasApi`, `hasSupabase`) checked at build time, baked into the app binary. No runtime feature flag service initially; LaunchDarkly / Unleash / in-house admin panel deferred to post-beta spike #130.

**Alternatives:** Runtime feature flags (LaunchDarkly, Unleash), Supabase `feature_flags` table, in-house admin portal.

**Why:** Compile-time flags are the simplest solution for v1.1.0 (the live beta pre-cutover phase). The app is built once per environment; users on staging get the staging binary (which may test Supabase-direct reads), users on prod get the prod binary (which points to Railway API). No additional infrastructure, no runtime lookups, no stale cache issues. Sufficient for the binary release / OTA update cadence until the team needs to do in-flight rollouts or gradual ramps.

**Trade-offs accepted:** Cutover requires a new build and binary release (or OTA update if all changes are JS-only). Users cannot be segmented at runtime (e.g., "10% get new API, 90% get old path"). Acceptable during beta; if the app scales to many users post-launch, a real feature flag system becomes necessary.

**Post-spike #130:** Once the live beta matures and the team identifies feature flags as a common need, revisit runtime solutions. Candidates: (a) LaunchDarkly (SaaS, free tier available), (b) Unleash (open-source, self-hosted or cloud), (c) Supabase `feature_flags` table (owned by the app, no external dependencies). Decision will be filed as a follow-up DESIGN_DECISIONS entry.
