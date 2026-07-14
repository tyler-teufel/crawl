# Roadmap

Prioritized next steps for Crawl, organized by release milestone.

> For the active, root-caused, date-scoped backlog (vote reset bug, filtering, layout, splash/branding, Global/Profile screens), see [Sprint Plan — July 2026](./SPRINT_PLAN_2026-07.md).

---

## v1.1 — Core Polish (Shipped)

Released as v1.1.0 (see `docs/design/RESKIN_SPEC_v1.1.0.md` for the reskin scope). Shipped: Vitest test suite, `react-native-maps` integration, Apple/Google/anonymous auth onboarding via Supabase, live backend wiring, and the v2 brand/font/logo reskin.

Still open from the original v1.1 list:

| Priority | Task            | Description                                                                                | Effort  |
| -------- | --------------- | ------------------------------------------------------------------------------------------- | ------- |
| Medium   | City selector   | Dropdown/modal picker for `CitySelector` listing all supported cities.                      | 0.5 day |
| Medium   | Venue images    | Replace image placeholders with real venue photos. Add image caching.                       | 1 day   |
| Medium   | Global Rankings | Build out the Global Rankings tab — city leaderboard, all-time top venues.                  | 1 day   |
| Medium   | Profile screen  | User avatar, voting history, stats (total votes, streaks), and settings.                    | 1 day   |
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
| Admin dashboard          | Venue owner portal for updating hours, photos, highlights, and viewing analytics.    | 5 days |

---

## Future Considerations

- **Multi-city expansion** — onboard new cities with venue import from Google Places / Yelp API
- **Monetization** — featured venue placements, premium user features (unlimited votes, early access)
- **Analytics** — Mixpanel or Amplitude integration for user behavior tracking
- **Localization** — i18n support for non-English markets
- **Offline support** — cache venue data for offline browsing with automatic sync on reconnect
