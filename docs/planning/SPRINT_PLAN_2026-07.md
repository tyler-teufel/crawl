# Sprint Plan — July 2026 Frontend Refactor

Agile backlog addressing the staging build's reported issues (layout/padding, broken filtering, vote-count reset bug, bland splash/login) plus scoping the two remaining placeholder screens. Each ticket is root-caused against the actual code (file:line), scoped to a semantic version, and assigned a target date. Tracked as [GitHub Issues](https://github.com/tyler-teufel/crawl/issues) mirroring this doc.

---

## Versioning baseline

Confirmed true baseline: **1.0.0, build 13** — currently deployed to staging/TestFlight.

- `apps/mobile/app.json` `expo.version` = `"1.0.0"` — matches the deployed staging build. No `ios.buildNumber`/`android.versionCode` is committed; `staging-build.yml:38-49` injects `buildNumber`/`versionCode` = `${{ github.run_number }}` (currently 13) at CI time and never commits it back. This is an intentional, correct pattern for monotonic App Store build numbers — just previously undocumented.
- `apps/mobile/package.json` = `"1.0.1"` — **drifted**. `apps/mobile/CHANGELOG.md` is an empty stub, meaning this version was hand-edited rather than produced by `changesets`. Reset to `1.0.0` to re-anchor to the real baseline (Ticket 0).
- `apps/api/package.json` = `"1.0.6"`, `packages/shared-types/package.json` = `"1.0.0"` — same drift signature (empty `CHANGELOG.md`). Flagged for a follow-up audit, not reset outright — the true deployed API version needs confirming first.
- Root `package.json` = `"0.0.0"` — correct as-is; it's the private workspace root and is never shipped.
- `@changesets/cli` is installed and `release-version.yml` (Version PR automation) exists but appears to have never actually been exercised (changelogs are empty everywhere) — versions were hand-edited instead. **Going forward: every ticket that changes `apps/mobile` ships a changeset; merging the resulting Version PR is the only way `package.json`/`CHANGELOG.md` change.**

**Rule to enforce:** for `apps/mobile`, `package.json.version` and `app.json expo.version` must always be identical — they describe the same shippable artifact.

Semver convention going forward: **patch** = bug fixes, **minor** = new non-breaking features/screens, **major** = breaking changes.

---

## Sprint cadence (1-week sprints, starting 2026-07-08)

| Sprint | Dates | Focus | Target version |
| --- | --- | --- | --- |
| Sprint 1 | Jul 8 – Jul 14 | Versioning standardization, vote/filter bugs, layout cleanup | v1.0.1 |
| Sprint 2 | Jul 15 – Jul 21 | Splash/logo, fonts, onboarding+login refresh | v1.1.0 |
| Sprint 3 | Jul 22 – Jul 28 | Global Rankings screen | v1.2.0 |
| Sprint 4 | Jul 29 – Aug 4 | Profile screen | v1.3.0 |

---

## Branching strategy

Work is grouped by release branch instead of merging every ticket straight to `main`:

- Cut `release/vX.Y.Z` from `main` at the start of each sprint (e.g. `release/v1.0.1` this week).
- Each ticket gets its own branch off that release branch — `fix/vote-state-persistence`, `fix/filter-predicates`, `fix/card-map-layout`, `chore/version-sync`, `feature/splash-logo`, etc. — PR'd back into the release branch, not `main`.
- Once every ticket for a version has merged into its release branch, the release branch merges into `main` as a single PR. That merge is what triggers the existing `release-version.yml` (changesets Version PR) and `staging-build.yml` (TestFlight staging build) automation, since both currently trigger on push to `main` — no CI changes required.
- Each ticket below records its target branch.

See [Contributing Guide](../guides/CONTRIBUTING.md#branching-convention) for the full convention.

---

## Backlog

### Epic V — Versioning Standardization (v1.0.1, Sprint 1 — do first, blocks the version bump)

**Ticket 0 — Re-anchor to the real 1.0.0(13) baseline and stop config drift** · `chore` · Branch: `chore/version-sync` off `release/v1.0.1`

- Reset `apps/mobile/package.json` from the drifted `1.0.1` back to `1.0.0` to match `app.json` and the actual deployed staging build.
- Add a sync step so `changeset version` writes the bumped `package.json` version into `apps/mobile/app.json`'s `expo.version` automatically.
- Document the build-number pattern (`github.run_number` injected at CI time, intentionally never committed).
- Correct the stale "1.0.0-alpha" reference in `docs/architecture/PROJECT_OVERVIEW.md`.
- Audit `apps/api` (`1.0.6`) and `packages/shared-types` (`1.0.0`) for the same drift signature — flag for follow-up, don't reset blind.

**Acceptance criteria:** `apps/mobile/package.json` and `app.json` both read `1.0.0` before any other Sprint 1 ticket lands; every subsequent version-affecting change ships as a changeset, not a hand-edit; root `package.json`'s "never shipped" status is documented.

---

### Epic A — Vote & Filter Reliability (v1.0.1, Sprint 1)

**Ticket 1 — Fix daily vote count reset** · `bug` · Branch: `fix/vote-state-persistence` off `release/v1.0.1`

- **Root cause:** `apps/mobile/src/api/votes.ts:22-31` — `useVoteState`'s mock `queryFn` unconditionally returns the hardcoded `DEFAULT_VOTE_STATE` (3/0) on *every* fetch, including refetches (5s `staleTime`, GC after unmount, city-switch). There is no persistence layer backing the mock vote state — it lives only in the React Query cache, which is exactly what gets wiped.
- **Fix approach:** back the mock vote state with a persisted store (AsyncStorage, already a dependency) keyed by date+city, matching the server's `today()`-scoped design in `apps/api/src/services/vote.service.ts`. `queryFn` reads the persisted entry for today; only falls back to `DEFAULT_VOTE_STATE` if no entry exists yet or the persisted date has rolled over. Consolidate the duplicated `DEFAULT_VOTE_STATE` constant (also in `apps/mobile/src/context/VenueContext.tsx:40-44`).

**Acceptance criteria:** 3 votes persist across refetch/navigation/backgrounding; a 4th attempt is rejected without resetting the count; state rolls over cleanly at day boundary; regression test added under `apps/mobile/tests/`.

**Ticket 2 — Fix broken filtering** · `bug` · Branch: `fix/filter-predicates` off `release/v1.0.1`

- **Root cause:** `apps/mobile/src/api/venues.ts:30` — the mock branch of `useVenues`'s `queryFn` returns `mockVenuesByCity[city]` unconditionally, ignoring the `filters` argument entirely. Additionally, no predicate logic exists anywhere client-side mapping filter ids (`apps/mobile/src/data/filters.ts:3-14` — `trending`, `open-now`, `live-music`, etc.) to actual `Venue` fields (`isTrending`, `isOpen`, `highlights`).
- **Fix approach:** add a `filterVenues(venues, activeFilterIds)` predicate util and apply it in the mock branch (the real-API branch already forwards filters correctly).
- **Open assumption to confirm before implementation:** multiple active filters combine as AND (intersection), not OR.

**Acceptance criteria:** each filter chip visibly changes `filteredVenues`; regression test added.

---

### Epic B — Explore Screen Layout Cleanup (v1.0.1, Sprint 1)

**Ticket 3 — Shrink venue cards, fix map/carousel padding** · `bug`/`improvement` · Branch: `fix/card-map-layout` off `release/v1.0.1`

- **Root cause:** `CARD_WIDTH = Dimensions.get('window').width * 0.8` (`apps/mobile/app/(tabs)/index.tsx:15`) is oversized; `VenueCard` (`apps/mobile/components/venue/VenueCard.tsx`) has no max/fixed height and stacks 5 padded sections (~180-220pt+ depending on content); the carousel wrapper (`index.tsx:91`) has no `maxHeight`, so the map (`flex-1`) gets squeezed unpredictably; no `minHeight` guard exists on the map container either.
- **Fix approach:** reduce `CARD_WIDTH` to ~60-65% of screen width; add explicit `maxHeight` to `VenueCard` and the carousel wrapper; add `minHeight` to the map `View`.

**Acceptance criteria:** on a baseline device (375×812), map keeps a guaranteed minimum height regardless of card content; ~1.5-2 cards visible per screen width; no visual overlap across loading/error/empty/populated states.

---

### Epic C — Splash, Branding & Onboarding Polish (v1.1.0, Sprint 2)

**Ticket 4 — Logo + animated splash** · `feature` · Branch: `feature/splash-logo` off `release/v1.1.0`

- **Current state:** static-only `app.json` splash config, no `expo-splash-screen` usage anywhere, no animation, no `preventAutoHideAsync`.
- **Scope:** produce a logo (mark + wordmark, purple `#7f13ec` accent per `DESIGN_DECISIONS.md`); wire `expo-splash-screen` with a custom animated transition (reanimated, already a dependency).
- **Flag:** logo artwork is a design deliverable, not code — needs a design pass or asset handoff before implementation starts.

**Acceptance criteria:** branded animated cold-launch splash on iOS/Android; no more than ~1s added latency.

**Ticket 5 — Font exploration & onboarding/login UI refresh** · `feature` · Branch: `feature/onboarding-refresh` off `release/v1.1.0`

- **Current state:** no `expo-font`/`useFonts` anywhere — system default font throughout; `app/(onboarding)/index.tsx` and `auth.tsx` are minimal centered layouts (icon placeholder, stacked buttons).
- **Scope:** evaluate 2-3 candidate typefaces (e.g. `expo-google-fonts`) fitting the nightlife/purple palette; wire `expo-font` loading app-wide; redesign onboarding + auth screen visuals (motion, imagery) without touching the existing Apple/Google/anonymous auth logic.

**Acceptance criteria:** chosen font loads without flash-of-default-font; auth flow behavior regression-tested unchanged.

---

### Epic D — Placeholder Screen Build-Out (Sprints 3-4, each its own minor release)

**Ticket 6 — Build Global Rankings screen** · `feature` · Sprint 3, v1.2.0 · Branch: `feature/global-rankings` off `release/v1.2.0`

Replace `app/(tabs)/global.tsx` placeholder with a city leaderboard + all-time top venues, reusing existing venue-list/card patterns; use `apps/api`'s `/trending/:city` if reachable, else mock data.

**Ticket 7 — Build Profile screen** · `feature` · Sprint 4, v1.3.0 · Branch: `feature/profile-screen` off `release/v1.3.0`

Replace `app/(tabs)/profile.tsx` placeholder with avatar, voting history, stats (total votes/streaks), settings, sign-out (ties into existing `AuthContext`).

---

## SDLC tooling recommendation

Three options evaluated for letting AI agents operate as the dev team:

- **GitHub Issues/Projects** — already connected, zero new setup, tightly coupled to the PR flow already in use (`subscribe_pr_activity`, draft PRs). Free, reversible, sufficient for a solo/small project. **Chosen for this backlog.**
- **Linear** — has a public MCP connector; shipped native "Agent" support in 2026 (Code Intelligence, MCP-based triage automation, cycles that map directly to sprints) purpose-built for AI coding agents. Best fit if the project grows beyond solo use.
- **Atlassian Rovo (Jira/Confluence)** — MCP went GA Feb 2026 with an official "Claude Agent for Jira." Powerful but heavier/enterprise-oriented; its MCP surface returns broad org data (routinely including PII/secrets), which is more exposure than this project needs right now.

**Recommendation:** stay on GitHub Issues/Projects for now — revisit Linear specifically (not Jira) if/when a second person joins, since its 2026 agent-native design is the closer match to "AI agents as a dev team" than Jira's heavier surface.
