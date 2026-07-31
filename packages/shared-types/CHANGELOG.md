# @crawl/shared-types

## 1.0.3

### Patch Changes

- 4c96b15: #64: fixed the daily vote budget resetting at UTC midnight (7-8pm Eastern, mid-evening — exactly when voting matters most) instead of at a sensible nightlife-day boundary. Added a canonical `voteDayFor`/`voteDayResetAt` helper to `@crawl/shared-types` (`packages/shared-types/src/voteDay.ts`) so the API, mobile mock store, and mobile countdown share one definition instead of drifting independently. The vote day now rolls over at 04:00 in the relevant city's timezone (`public.cities.timezone`, all `America/New_York` today) rather than the raw UTC calendar date, using a real `Intl.DateTimeFormat`-based zoned-time conversion (verified across the 2026 DST transitions) instead of a fixed UTC offset. `apps/api/src/services/vote.service.ts`'s `today()`, the `VoteRepository.create`/`delete` implementations (which previously stamped `votedAt` from either a second, independent `today()` or Postgres's `CURRENT_DATE` default), and the `reset-votes` cron schedule (now `04:00 America/New_York` instead of `00:00 UTC`) all derive from the shared helper. Mobile now shares the same boundary: `apps/mobile/src/api/voteStorage.ts`'s mock vote-state date key and `apps/mobile/src/hooks/useCountdown.ts`'s reset countdown both derive from the shared helper (falling back to `DEFAULT_VOTE_DAY_TIMEZONE` — mobile doesn't resolve a per-city timezone yet) instead of raw UTC date/local midnight.

## 1.0.2

### Patch Changes

- 23cec89: Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.

## 1.0.1

### Patch Changes

- 3dc86e4: Add optional `resetAt` (ISO 8601 datetime string) to the shared `VoteState` type to
  match the server's vote state response, allowing clients to display when daily votes
  reset without a type assertion.
