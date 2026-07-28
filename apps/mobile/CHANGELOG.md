# @crawl/mobile

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
