# Roadmap

Prioritized next steps for Crawl, organized by release milestone.

> For the active, root-caused, date-scoped backlog (vote reset bug, filtering, layout, splash/branding, Global/Profile screens), see [Sprint Plan — July 2026](./SPRINT_PLAN_2026-07.md).

---

## v1.1 — Core Polish (Shipped)

Released as v1.1.0 (see `docs/design/RESKIN_SPEC_v1.1.0.md` for the reskin scope). Shipped: Vitest test suite, `react-native-maps` integration, Apple/Google/anonymous auth onboarding via Supabase, live backend wiring, and the v2 brand/font/logo reskin.

Shipped in v1.1.0:

| Task            | Description                                                                                | Shipped |
| --------------- | ------------------------------------------------------------------------------------------- | ------- |
| Global Rankings | City leaderboard, all-time top venues by score, backed by `/trending/:city` (#50)          | ✓ |
| Profile screen  | User avatar, voting history lookup, stats, sign-out (#51)                                  | ✓ |

Still open from the original v1.1 list:

| Priority | Task            | Description                                                                                | Effort  |
| -------- | --------------- | ------------------------------------------------------------------------------------------- | ------- |
| Medium   | City selector   | Dropdown/modal picker for `CitySelector` listing all supported cities.                      | 0.5 day |
| Medium   | Venue images    | Replace image placeholders with real venue photos. Add image caching.                       | 1 day   |
| Low      | Haptic feedback | Trigger haptics on vote cast, tab switch, and button press using `expo-haptics`.             | 0.5 day |
| Low      | Pull-to-refresh | Add pull-to-refresh on the voting screen venue list.                                        | 0.5 day |

---

## v1.2 — Backend & Infrastructure (Shipped, partial)

The backend API, TanStack Query wiring, and EAS/CI pipeline described in the original v1.2 plan are built and running (see `docs/architecture/API_REFERENCE.md`, `docs/ops/CICD_PIPELINE.md`). Historical planning docs for this phase live in `docs/archive/` (`BACKEND_IMPLEMENTATION_PLAN.md`, `DATA_PIPELINE.md`, `DEV_STAGING_PLAN.md`).

Still open:

| Task                | Description                                                                                                                  | Effort |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Push notifications  | Trending alerts when a venue's score crosses a threshold. Use `expo-notifications`.                                            | 1 day  |
| Venue bookmarking   | Save/unsave venues, bookmarks list accessible from Profile tab.                                                                | 1 day  |
| Accessibility       | Add `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all interactive components. Screen reader testing.   | 1 day  |
| Rate limiting       | Enforce the rate limits documented as "planned" in `docs/architecture/API_REFERENCE.md`.                                       | 0.5 day|

---

## v2.0 — Social & Engagement (Medium Term)

> **Superseded by the [Crawl v2 Product & Design Proposal](./CRAWL_V2_PROPOSAL.md)** (adopted 2026-07-09) — the full v2 direction: brand overhaul, Spotify-style discovery IA, milestone ladder M1–M10, and committed design assets under `docs/design/`. The feature list below survives inside v2 Milestone 7 (Social Features); effort estimates here are stale.

| Task                     | Description                                                                          | Effort |
| ------------------------ | ------------------------------------------------------------------------------------ | ------ |
| Real-time vote updates   | WebSocket connection for live score changes. Animate score transitions in real-time. | 2 days |
| Social features          | Friend system, group crawls, share itineraries.                                      | 5 days |
| Venue check-in           | GPS-verified check-in at venues. Earn badges and streaks.                            | 2 days |
| Review & rating system   | User reviews, star ratings, and review feed on venue detail.                         | 3 days |
| Bar crawl route planning | Multi-venue route builder with estimated walking times between stops.                | 3 days |
| Admin dashboard          | Venue owner portal for updating hours, photos, highlights, and viewing analytics. External/self-serve — distinct from the internal [admin venue portal](#admin-venue-portal-separate-repo-unscheduled) below. | 5 days |

---

## Admin Venue Portal (separate repo, unscheduled)

A small standalone website letting internal admins edit venue information through a UI instead of hand-writing SQL in the Supabase dashboard. Invite-only accounts tied to an email address plus a phone number; writes go through an API that performs the SQL updates, so the browser never touches the database. Lives in **its own repository** — the first deliberate step toward an eventual microservices split.

Distinct from the v2.0 "Admin dashboard" row above: that one is external, self-serve, per-venue, for venue owners, and includes analytics. This is internal, invite-only, all-venues, staff-only, no analytics.

**Blocking constraint:** the Google Places sync job (`apps/api/src/jobs/syncVenues.ts`) upserts on `google_place_id` and overwrites `name`, `address`, `phone`, `website`, `hours`, `rating`, `price_level`, and `is_active` on every run — admin edits to those fields would be silently reverted. Fields the sync leaves alone (`description`, `image_url`, `highlights`, `is_trending`) are safe to edit today, and scoping v1 to those is the cheapest resolution.

**Open decisions before scheduling:** whether the phone number is a second factor or a co-primary credential; whether admin writes extend `apps/api` or get their own service; how a repo outside the monorepo consumes `packages/shared-types`; hosting; and whether this supersedes the "in-house admin panel" option in the [rollout-control spike](https://github.com/tyler-teufel/crawl/issues/130).

Tracked as [#152](https://github.com/tyler-teufel/crawl/issues/152).

---

## Future Considerations

- **Multi-city expansion** — onboard new cities with venue import from Google Places / Yelp API
- **Monetization** — featured venue placements, premium user features (unlimited votes, early access)
- **Analytics** — Mixpanel or Amplitude integration for user behavior tracking
- **Localization** — i18n support for non-English markets
- **Offline support** — cache venue data for offline browsing with automatic sync on reconnect
