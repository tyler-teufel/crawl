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

## Fingerprint Runtime Version for OTA

**Chosen over:** `runtimeVersion: { policy: "appVersion" }` or `"sdkVersion"`, or a hand-maintained string.

`appVersion` and `sdkVersion` policies require the engineer to remember when to bump the runtime — and "remembering" is exactly the failure mode that ships an OTA bundle to a binary that lacks the required native code, causing crashes.

`policy: "fingerprint"` (set in `apps/mobile/app.json`) computes a hash over the project's native dependencies. The runtime version becomes a property of what was actually built. EAS Update only delivers an OTA bundle to a binary whose runtime version matches — so a JS bundle built after a `react-native-maps` upgrade simply does not reach binaries built before that upgrade. The CI fingerprint job in `ci.yml` surfaces these changes during PR review.

**Trade-off:** Slightly opaque — engineers can't read the runtime version off a config file, they have to ask Expo. Acceptable, because the alternative is silent OTA-induced crashes.

---

## Direct Supabase Query Path from Mobile

**Chosen over:** routing every venue read through `apps/api`.

While the Fastify API is being built out (per `docs/planning/BACKEND_IMPLEMENTATION_PLAN.md`), the mobile app reads venue data directly from Supabase using `@supabase/supabase-js` with the publishable anon key. The TanStack Query hooks in `src/api/venues.ts` branch on env vars:

1. If `EXPO_PUBLIC_API_URL` is set → call the Fastify API.
2. Else if `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_KEY` are set → query Supabase directly.
3. Else → return mock data.

**Why:** unblocks end-to-end testing on real data while the API matures. Supabase Row Level Security policies are the trust boundary on direct reads; the publishable key is safe to ship in the bundle.

**Trade-off:** Two read paths to maintain. The plan is to retire the direct path once the API exposes the corresponding endpoints — at which point the mobile-side Supabase import in `src/api/venues.ts` is deleted, not refactored. This is intentionally not abstracted behind a "data source" interface; the branch is three lines and removing it is one delete.

**Coordinate handling:** the venues table's `latitude` / `longitude` columns are `numeric`, which Supabase serializes as strings. `rowToVenue()` coerces them with `Number(...)` and drops rows with non-finite coordinates with a `__DEV__` warning so silent map-render failures surface during testing.

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
- `app/_layout.tsx` — `OnboardingGate` reads the flag and emits `<Redirect href="/(onboarding)" />` until the user completes the flow.

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

**Why store the display string and not the UUID:**

The `venues` table currently denormalizes city as a `"Name, State"` text column (with a TODO in the schema to migrate to `cityId` lookups). The mobile app keys queries off this same string so the data path stays simple. When the schema migration to `cityId` lands, swap to UUID in one place (`useVenues`) without touching the rest of the context. Switching now would require two reads in lockstep — schema cleanup first, app change second.

**Trade-off:** the display string format must stay consistent across `cities.name + ', ' + cities.state` and `venues.city`. The seed and sync jobs currently produce this format; document this contract in `apps/api/src/jobs/syncVenues` if a contributor proposes changing it.
