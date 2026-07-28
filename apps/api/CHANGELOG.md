# @crawl/api

## 1.0.7

### Patch Changes

- 1eb5163: Fix the venue sync job silently assigning out-of-radius Google Places results to the city being synced (#167). `locationBias` on `searchText` was always a soft preference, not a hard filter, and nothing validated distance before stamping a place with `cityId`. The sync job now rejects any place farther than `radiusMeters` from the city's geocoded center before it is ever upserted, logging the venue name and distance and recording the rejection in `SyncCityResult.errors` so out-of-bounds counts are visible in a sync run.
- 9a562aa: Bump `node-cron` from `^3.0.3` to `^4.6.0` to clear the `uuid < 11.1.1` buffer-bounds-check advisory (GHSA-w5hq-g745-h8pq), which was pulled in transitively via node-cron's v3 dependency on `uuid@8.3.2`. node-cron v4 is a zero-dependency rewrite, so the advisory is removed entirely rather than patched. Updated the two job files (`reset-votes.ts`, `recalculate-scores.ts`) for v4's typings, which now export `ScheduledTask` as a named type rather than a property of the default import; schedules and timezone behavior (daily vote reset at 00:00 UTC, hourly hotspot score recalculation) are unchanged. Also dropped the now-redundant `@types/node-cron` devDependency since v4 ships its own type declarations.
- 23cec89: Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.
- Updated dependencies [23cec89]
  - @crawl/shared-types@1.0.2
