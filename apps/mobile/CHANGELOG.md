# @crawl/mobile

## 1.1.0

### Minor Changes

- b2e7ee1: Re-add a Supabase-direct read branch for venues and cities, gated behind `hasSupabase`. Reads now branch `hasApi` → `hasSupabase` → bundled mock data, so the app can read live venue/city data from Supabase (RLS permits public read) without a Railway API deployment.
- 67daf98: Build the Global Rankings screen: a real city leaderboard of top venues (via a new `useTrending` hook, mock/real-API fallback) replacing the placeholder tab.
- 5514c6f: Build the Profile tab: avatar/identity, today's voting history, stats, settings, and sign-out.

### Patch Changes

- e25cfa6: Flatten the mock vote budget from per-city to a single global 3-votes/day pool, matching the server contract, and have the mock throw a `NO_VOTES_REMAINING`/`ALREADY_VOTED` error on exhaustion/duplicate casts instead of silently no-op'ing.
- 480d9dd: Apply v2 typography (font-display/font-sans families) to VoteCounter, CountdownTimer, and CitySelector, matching the reskinned Voting screen.
- c269199: Declare `@crawl/shared-types` as an explicit dependency instead of relying on npm workspace hoisting.
