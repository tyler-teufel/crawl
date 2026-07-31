# @crawl/mobile

## 1.1.2

### Patch Changes

- 38fae5a: #126: wired `useCastVote`'s Supabase-direct write path to the new `public.cast_vote` Postgres RPC (`apps/api/drizzle/0007_cast_vote_rpc.sql`) instead of silently falling through to the mock vote layer whenever only `EXPO_PUBLIC_SUPABASE_URL`/`KEY` were configured (no `EXPO_PUBLIC_API_URL`) — the RPC is now the only place the 3-vote/day cap and per-venue dedup are actually enforced for this beta, since the equivalent check in `apps/api/src/services/vote.service.ts` lives on the undeployed Fastify path. `apps/mobile/src/api/votes.ts`'s `useCastVote` mutation now branches `hasApi` → `hasSupabase` → mock, calling `supabase.rpc('cast_vote', { p_venue_id })` and mapping its `NO_VOTES_REMAINING`/`ALREADY_VOTED`/`VENUE_NOT_FOUND`/`AUTH_REQUIRED` error codes (matched by exact `error.message` equality) to the same `VoteError` shape the mock layer already throws (#62/#134), so `useCastVote` consumers hit one error-handling code path regardless of mode. `useRemoveVote` is intentionally unchanged: the backend ships no remove-vote RPC and RLS blocks a direct `DELETE` on `votes` for `authenticated`, so it keeps falling back to the mock implementation whenever `EXPO_PUBLIC_API_URL` is unset. Added `apps/mobile/tests/castVoteTierSelection.test.ts` covering a successful cast, a 4th-cast `NO_VOTES_REMAINING` rejection, and a duplicate-cast `ALREADY_VOTED` rejection in both mock and Supabase tiers, an unrecognized RPC error passing through unmodified, Railway-API tier precedence, and `useRemoveVote`'s mock fallback in Supabase-only mode. Unverified against a live Supabase project — the connector was not authorized this session, so `castSupabaseVote` is only exercised against a mocked `supabase.rpc`, not the real RPC.
- 206a70d: Fix onboarding/auth flow reappearing on every launch (#158). `OnboardingGate` (`app/_layout.tsx`) only had one source of truth — the `crawl.firstLaunchComplete.v1` AsyncStorage flag — and a read failure on that key was silently swallowed into "show onboarding," with no report and no fallback. The gate now also checks whether a Supabase session was already persisted before this launch's auth bootstrap ran; a returning session is proof the user already completed the auth step, regardless of what the flag read back, while a session freshly minted for a genuinely new install still does not skip onboarding. The flag read and the session read settle independently and at different speeds (the session read can trigger a network token refresh), so the gate now withholds rendering until both have settled (`resolveOnboardingGateStatus`) instead of redirecting off a stale flag-only verdict. AsyncStorage read failures for the flag are now reported via `Sentry.captureException` (`src/lib/onboarding.ts`'s new `readOnboardingFlag`) instead of failing silently.
- 4c96b15: #64: fixed the daily vote budget resetting at UTC midnight (7-8pm Eastern, mid-evening — exactly when voting matters most) instead of at a sensible nightlife-day boundary. Added a canonical `voteDayFor`/`voteDayResetAt` helper to `@crawl/shared-types` (`packages/shared-types/src/voteDay.ts`) so the API, mobile mock store, and mobile countdown share one definition instead of drifting independently. The vote day now rolls over at 04:00 in the relevant city's timezone (`public.cities.timezone`, all `America/New_York` today) rather than the raw UTC calendar date, using a real `Intl.DateTimeFormat`-based zoned-time conversion (verified across the 2026 DST transitions) instead of a fixed UTC offset. `apps/api/src/services/vote.service.ts`'s `today()`, the `VoteRepository.create`/`delete` implementations (which previously stamped `votedAt` from either a second, independent `today()` or Postgres's `CURRENT_DATE` default), and the `reset-votes` cron schedule (now `04:00 America/New_York` instead of `00:00 UTC`) all derive from the shared helper. Mobile now shares the same boundary: `apps/mobile/src/api/voteStorage.ts`'s mock vote-state date key and `apps/mobile/src/hooks/useCountdown.ts`'s reset countdown both derive from the shared helper (falling back to `DEFAULT_VOTE_DAY_TIMEZONE` — mobile doesn't resolve a per-city timezone yet) instead of raw UTC date/local midnight.
- 1054ec6: Read the daily vote state from the server on the Supabase path. `useVoteState` branched on `hasApi` alone, so a Supabase-only build wrote votes to Postgres but read them back from AsyncStorage — a reinstall appeared to grant a fresh daily budget while the server still held the user's votes.
- Updated dependencies [4c96b15]
  - @crawl/shared-types@1.0.3

## 1.1.1

### Patch Changes

- 273c705: Format Google Places venue types for display — `lounge_bar` now renders as "Lounge Bar" instead of a raw snake_case token on venue cards, list items, map callouts, and the detail screen. Applied at the data boundary in `rowToVenue`; already-formatted strings (bundled mock venues) pass through untouched.
- 3021774: Fix the Explore map camera never recentering when the selected city changes (#166): it now animates to the selected city's center and frames its coverage radius (Sayville and Charlotte no longer render at the same zoom), instead of statically framing whichever venue happened to sort first.
- 273c705: Fix live venue data never loading on Supabase-direct builds. Venue queries now filter on `venues.city_id` (resolved from the selected city via `resolveCityId`) instead of the denormalized `venues.city` text column, which the ingest job writes as `"Charlotte"` while the client holds `"Charlotte, NC"` — matching zero rows for every city. `useTrending` gains the Supabase tier it was missing, so Global Rankings shows real venues instead of silently rendering bundled mock data. All read hooks now branch on a single `dataSource` value from `env.ts`.
- 273c705: Fix two spacing defects reported on the v1.1.0 TestFlight build: venue card badges no longer overlap the placeholder icon on image-less venues (they render inline above the venue name instead of overlaying the short hero), and the Explore filter chip row now has breathing room above the map.
- Updated dependencies [23cec89]
  - @crawl/shared-types@1.0.2

## 1.1.0

### Minor Changes

- b2e7ee1: Re-add a Supabase-direct read branch for venues and cities, gated behind `hasSupabase`. Reads now branch `hasApi` → `hasSupabase` → bundled mock data, so the app can read live venue/city data from Supabase (RLS permits public read) without a Railway API deployment.
- 67daf98: Build the Global Rankings screen: a real city leaderboard of top venues (via a new `useTrending` hook, mock/real-API fallback) replacing the placeholder tab.
- 5514c6f: Build the Profile tab: avatar/identity, today's voting history, stats, settings, and sign-out.

### Patch Changes

- e25cfa6: Flatten the mock vote budget from per-city to a single global 3-votes/day pool, matching the server contract, and have the mock throw a `NO_VOTES_REMAINING`/`ALREADY_VOTED` error on exhaustion/duplicate casts instead of silently no-op'ing.
- 480d9dd: Apply v2 typography (font-display/font-sans families) to VoteCounter, CountdownTimer, and CitySelector, matching the reskinned Voting screen.
- c269199: Declare `@crawl/shared-types` as an explicit dependency instead of relying on npm workspace hoisting.
