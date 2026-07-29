# @crawl/api

## 1.0.8

### Patch Changes

- 7ebbfd6: Sprint 4 users/venues migration wave (#77, #129, #131, #167 remediation, #156):

  - Removed the dead custom bcrypt `/auth/register`, `/auth/login`, and `/auth/refresh` routes, `AuthService`, and the `UserRepository`/`DrizzleUserRepository` pair. These only ever ran in local in-memory dev mode and were unreachable in production, where Supabase JWT verification via JWKS (`plugins/jwt.ts`) is the only auth path. Dropped `users.password_hash` and the `bcryptjs` dependency accordingly.
  - Added `public.users.device_id` (abuse/dedup signal only, no auth-flow use) and `public.users.role` (`'user' | 'developer'`, `text` with a `CHECK` constraint). Replaced the per-request Supabase-user upsert in `jwt.ts` (which only fired for users hitting an authenticated endpoint) with a `SECURITY DEFINER` trigger on `auth.users` that provisions a `public.users` row for every identity, anonymous or linked, at creation time — plus a backfill for the 14 identities that predated it. Tightened the `users: update own` RLS policy's practical effect by revoking table-wide `UPDATE` from `authenticated` and re-granting it only on non-`role` columns, since a column-level `REVOKE (role)` alone does not narrow a table-wide grant.
  - Reassigned the 27 `South End, Charlotte` venues to `Charlotte` and removed the `South End, Charlotte` `cities` row (Charlotte's existing 8000m radius already covers them). Corrected Sayville's `radius_meters` from 250 (a dropped zero) to 2500, matching Patchogue's radius for a same-scale town. Reassigned or deactivated the remaining out-of-radius venues from #167 based on an actual distance-to-city-center recomputation, rather than the ingest-time snapshot.

## 1.0.7

### Patch Changes

- 1eb5163: Fix the venue sync job silently assigning out-of-radius Google Places results to the city being synced (#167). `locationBias` on `searchText` was always a soft preference, not a hard filter, and nothing validated distance before stamping a place with `cityId`. The sync job now rejects any place farther than `radiusMeters` from the city's geocoded center before it is ever upserted, logging the venue name and distance and recording the rejection in `SyncCityResult.errors` so out-of-bounds counts are visible in a sync run.
- 9a562aa: Bump `node-cron` from `^3.0.3` to `^4.6.0` to clear the `uuid < 11.1.1` buffer-bounds-check advisory (GHSA-w5hq-g745-h8pq), which was pulled in transitively via node-cron's v3 dependency on `uuid@8.3.2`. node-cron v4 is a zero-dependency rewrite, so the advisory is removed entirely rather than patched. Updated the two job files (`reset-votes.ts`, `recalculate-scores.ts`) for v4's typings, which now export `ScheduledTask` as a named type rather than a property of the default import; schedules and timezone behavior (daily vote reset at 00:00 UTC, hourly hotspot score recalculation) are unchanged. Also dropped the now-redundant `@types/node-cron` devDependency since v4 ships its own type declarations.
- 23cec89: Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.
- Updated dependencies [23cec89]
  - @crawl/shared-types@1.0.2
