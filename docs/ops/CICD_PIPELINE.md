# CI/CD Pipeline

Crawl is **trunk-based on `main`** with **independent semver per service** and **tag-triggered releases**. There is no release branch — ticket branches PR directly into `main`. Version bookkeeping is automated via Changesets; a release happens only when a human pushes a version tag (`api-vX.Y.Z` / `mobile-vX.Y.Z`), and production deploys are additionally gated by a GitHub Environment approval.

---

## Pipeline Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                          │
│                                                                    │
│   Local Dev ──► npm run changeset ──► git push ──► PR ──► Review   │
│                 (describe bumps)                                   │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────────────────┐
│                    CI PIPELINE (ci.yml)                            │
│                    Trigger: pull_request, push → main              │
│                                                                    │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ JOB: validate                                          │        │
│  │  • npm ci  •  Turbo cache restore                      │        │
│  │  • turbo run lint typecheck test                       │        │
│  │       --filter=...[origin/<base>]   (PRs only)         │        │
│  │  • Upload api/coverage if produced                     │        │
│  └────────────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ JOB: fingerprint (parallel)                            │        │
│  │  @expo/fingerprint hash → output for OTA eligibility   │        │
│  └────────────────────────────────────────────────────────┘        │
└──────────┬─────────────────────────────────────────────────────────┘
           │  Same PR also runs:
           ▼
┌────────────────────────────────────────────────────────────────────┐
│                  SECURITY (security.yml)                           │
│                  Trigger: PR, push → main, weekly cron             │
│                                                                    │
│  • CodeQL (javascript-typescript, security-and-quality)            │
│  • gitleaks (secret scan over full history)                        │
│  • npm audit --audit-level=high                                    │
│      └─ warn on PR, fail on schedule                               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
     merge to main
           │
           ▼
┌────────────────────────────────────────────────────────────────────┐
│             VERSION PR (release-version.yml)                       │
│             Trigger: push → main                                   │
│                                                                    │
│  changesets/action@v1 opens / updates a single                     │
│  "chore(release): version packages" PR aggregating every           │
│  pending .changeset/*.md. Merging that PR:                         │
│    • bumps versions in apps/mobile, apps/api, packages/shared-types│
│    • writes / appends each CHANGELOG.md                            │
│    • removes the consumed changeset files                          │
│  No publish step — all packages are private.                       │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           │  Versions are now bumped on main, but nothing has shipped.
           ▼
┌────────────────────────────────────────────────────────────────────┐
│  HUMAN: git tag api-vX.Y.Z (or mobile-vX.Y.Z[...]) && git push     │
│  See "How to cut a release" below. The tag IS the release trigger. │
└──────────┬─────────────────────────────────────────────────────────┘
           │  Tag push fires the matching workflow below.
           ▼
┌─────────────────────────────────┐  ┌─────────────────────────────┐
│  RELEASE — MOBILE                │  │  RELEASE — API              │
│  (release-mobile.yml)            │  │  (release-api.yml)          │
│  Trigger: push tags mobile-v*    │  │  Trigger: push tags api-v*  │
│  (+ workflow_dispatch to re-run  │  │  (+ workflow_dispatch to    │
│   an existing tag)               │  │   re-run an existing tag)   │
│                                  │  │                             │
│  Steps:                          │  │  Steps:                     │
│   1. resolve: parse the tag →    │  │   1. resolve: parse the tag │
│      version/channel/type        │  │      → version/environment │
│   2. Version-consistency guard   │  │   2. Version-consistency    │
│      (tag vs package.json/       │  │      guard (tag vs          │
│      app.json expo.version)      │  │      apps/api/package.json) │
│   3. Validate (lint+typecheck)   │  │   3. Validate (lint+tc+test)│
│   4a. OTA: eas update --channel  │  │   4. Build & push ghcr image│
│   4b. Binary: eas build          │  │      (production gated by   │
│       (staging also submits to   │  │       GH env approval)      │
│        TestFlight; production    │  │                             │
│        submit stays manual)      │  │                             │
│   5. GitHub Release + CHANGELOG  │  │   5. Migrate (opt-in via    │
│                                  │  │      RUN_DB_MIGRATIONS var) │
│                                  │  │   6. GitHub Release +       │
│                                  │  │      CHANGELOG              │
└─────────────────────────────────┘  └─────────────────────────────┘
```

---

## Workflow Files

| File                                       | Trigger                          | Purpose                                                |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------ |
| `.github/workflows/ci.yml`                 | `pull_request`, `push → main` (always runs; job-level path filter) | Lint, typecheck, test (Turbo affected detection)       |
| `.github/workflows/security.yml`           | PR, push → main, weekly schedule | CodeQL + gitleaks + npm audit                          |
| `.github/workflows/release-version.yml`    | `push → main` (path-filtered)    | Open / update Changesets "Version Packages" PR         |
| `.github/workflows/release-mobile.yml`     | `push → tags: mobile-v*`; `workflow_dispatch` (re-run an existing tag) | OTA or binary release of `apps/mobile` via EAS |
| `.github/workflows/release-api.yml`        | `push → tags: api-v*`; `workflow_dispatch` (re-run an existing tag) | Docker build/push + optional migrate of `apps/api` |
| `.github/workflows/staging-build.yml`      | `push → main` (path-filtered)    | EAS staging build (iOS → TestFlight, Android → internal) |
| `.github/workflows/sync-venues.yml`        | scheduled / manual               | Operational job — unrelated to releases                |
| `.github/workflows/dependabot-auto.yml.txt`| (disabled — see commit b9c7d75)  | Held in `.txt` form; Dependabot is currently off       |

---

## Tag Grammar

Both release workflows are triggered purely by pushing a tag; each workflow's
`resolve` job parses the tag name with a regex and never computes a version
itself. A tag that doesn't parse fails fast with `::error::` and a non-zero
exit — nothing downstream runs.

| Tag                                | Service | Kind                  | Target     |
| ----------------------------------- | ------- | ---------------------- | ---------- |
| `api-v1.2.3`                        | API     | Docker build + deploy  | production |
| `api-v1.2.3-staging`                | API     | Docker build + deploy  | staging    |
| `mobile-v1.2.3`                     | Mobile  | binary (EAS build)     | production |
| `mobile-v1.2.3-staging`             | Mobile  | binary (EAS build)     | staging    |
| `mobile-v1.2.3-ota.<ts>`            | Mobile  | OTA (`eas update`)     | production |
| `mobile-v1.2.3-staging-ota.<ts>`    | Mobile  | OTA (`eas update`)     | staging    |

**Parse rules:** strip the service prefix (`api-v` / `mobile-v`), take the
leading semver (`X.Y.Z`); if a `-staging` segment follows, target is staging,
else production; for mobile, if a `-ota.<timestamp>` segment follows, the
release is OTA, else binary. `<ts>` is a UTC timestamp
(`date -u +%Y%m%d%H%M%S`) used only to make repeat OTAs on the same version
distinct tags — it plays no role in version resolution.

**Version-consistency guard:** each workflow re-derives the semver from
`package.json` (API) or from both `package.json` and `app.json`'s
`expo.version` (mobile) at the tagged commit, and fails the run if either
disagrees with the version parsed from the tag name. Since Changesets
(`release-version.yml`) is the only process allowed to bump those files, a
mismatch means the tagged commit's version was never actually bumped by a
merged Version PR — the guard exists to make that unshippable rather than a
silent drift between the tag and what's inside the artifact.

---

## How to cut a release

1. Merge the Changesets **"chore(release): version packages"** PR opened by
   `release-version.yml`. This is what bumps `apps/api/package.json` and/or
   `apps/mobile/package.json` + `app.json` (`expo.version`), and writes the
   `CHANGELOG.md` section(s) that the release workflow later reuses as the
   GitHub Release body.
2. Pull `main` and confirm the bumped version:
   ```bash
   git pull origin main
   node -p "require('./apps/api/package.json').version"
   node -p "require('./apps/mobile/package.json').version"
   ```
3. Tag the commit and push the tag — pushing it is what triggers the release:
   ```bash
   # API, production
   git tag api-v1.2.3 && git push origin api-v1.2.3

   # API, staging
   git tag api-v1.2.3-staging && git push origin api-v1.2.3-staging

   # Mobile, binary (production)
   git tag mobile-v1.2.3 && git push origin mobile-v1.2.3

   # Mobile, OTA (production) — timestamp disambiguates repeat OTAs
   git tag mobile-v1.2.3-ota.$(date -u +%Y%m%d%H%M%S)
   git push origin --tags
   ```
4. Watch the triggered workflow run under the Actions tab.
5. If it targets `production`, approve the `production` GitHub Environment
   gate when prompted — this is now the sole human checkpoint (there is no
   `workflow_dispatch` button to press first anymore; the tag is the trigger).
6. On success, check the GitHub Release created for the tag. Staging tags are
   marked as a prerelease.

To re-run a release against a tag that's already been pushed (e.g. retry a
flaky `build-and-push`), dispatch the workflow manually and pass the existing
tag name as the `tag` input — this does not create a new tag or re-resolve
the version, it just re-executes the same tagged release.

---

## Path-Filter Policy (docs / workflow-only changes)

A push or PR that touches only `docs/**`, `wiki/**`, `**/*.md`, or (in most
cases) `.github/**` cannot affect the shipped app. Three workflows care about
that distinction, and each filters differently depending on whether it backs
a *required* branch-protection status check:

| Workflow                | Filter mechanism                                                                                                                                        | Why                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staging-build.yml`      | `paths-ignore` on the trigger itself                                                                                                                     | Not a required PR status check — only fires on `push → main`, so a skipped run has no PR waiting on it. Safe to filter at the trigger level. (Predates this ticket — see commit `9d0196d`.) |
| `release-version.yml`    | `paths-ignore` on the trigger itself                                                                                                                     | Same reasoning — it only opens/updates the Version PR after a push to `main`, and a docs-only push has no pending changeset to consume anyway.                                          |
| `ci.yml`                 | **No trigger-level filter.** A `changes` job (`dorny/paths-filter`) always runs first. `validate` — the required status check — always runs too, but skips its `npm ci` / Turbo steps when `needs.changes.outputs.app != 'true'`. `mobile-bundle` and `fingerprint` (not required) skip entirely in that case. | `validate` is a required branch-protection check. If its trigger were path-filtered directly, a docs-only PR would produce no `validate` run at all, and GitHub reports a required check with no run as permanently pending — blocking the merge (see #84). Keeping the job present but making its work conditional avoids that failure mode while still skipping the expensive lint/typecheck/test/build work on pure docs or workflow-comment edits. |

**Branch-protection implication:** if `mobile-bundle` or `fingerprint` are
ever promoted to required status checks, their current "skip the whole job"
shape would reproduce the same stuck-pending failure mode that `validate`
avoids. Convert them to the same "always run, conditionally skip steps"
shape first.

This repo has no branch-protection-as-code, so the required-check list can
only be confirmed/changed via GitHub Settings → Branches. This was not
verified against live settings as part of this change — see the note in the
Branch Protection section below.

---

## Versioning — Independent Semver via Changesets

Each service has its own version line and its own tag prefix:

| Package                  | Tag prefix          | Owns                                  |
| ------------------------ | ------------------- | ------------------------------------- |
| `@crawl/mobile`          | `mobile-vX.Y.Z`     | `apps/mobile`                         |
| `@crawl/api`             | `api-vX.Y.Z`        | `apps/api`                            |
| `@crawl/shared-types`    | `shared-types-vX.Y.Z` | `packages/shared-types` (when needed) |

OTA-only mobile releases get the suffix `-ota.<UTC-timestamp>` so an OTA on top of `mobile-v1.4.0` becomes e.g. `mobile-v1.4.1-ota.20260427143055`.

**Workflow as a contributor:**

```bash
# After making a change worth a version bump
npm run changeset
# answers prompt: which packages, bump type, summary
git add .changeset/<file>.md
git commit -m "feat(mobile): add city selector"
```

When the PR merges to `main`, the **Release — Version PR** workflow opens (or updates) a `chore(release): version packages` PR aggregating every pending changeset. Merging that PR is what actually performs the version bump and writes `CHANGELOG.md`.

Skip a changeset for: pure docs changes, internal refactors with no behavior change, test-only edits. Otherwise add one — they're cheap.

See `.changeset/README.md` for the contributor walkthrough.

---

## Mobile release: OTA vs Binary

The mobile release workflow's `resolve` job derives `release_type` (`ota` or `binary`) from the tag name (see Tag Grammar above) — there's no input to choose from anymore, so pick the *tag* that matches what changed:

| Change                                  | Release type | Why                                       |
| --------------------------------------- | ------------ | ----------------------------------------- |
| JS / TSX components, hooks, styles      | `ota`        | No native rebuild needed                  |
| Tailwind / NativeWind class changes     | `ota`        | Pure JS bundle                            |
| New / upgraded native module            | `binary`     | OTA can't ship native code                |
| Expo SDK upgrade                        | `binary`     | New native runtime                        |
| Permissions, `app.json`, splash, icons  | `binary`     | Native config                             |
| Anything in `ios/` or `android/`        | `binary`     | Native code                               |

`runtimeVersion` is configured in `apps/mobile/app.json` as:

```json
"runtimeVersion": { "policy": "fingerprint" }
```

Expo computes a hash over your native dependencies. Each binary is bound to that hash; the OTA delivery system only sends a JS bundle to a binary whose runtime version matches. **You cannot accidentally ship JS that needs a native rebuild — the bundle simply won't be delivered to incompatible binaries.**

**Channels = environments.** The build profiles in `apps/mobile/eas.json` map to channels:

| Profile (eas.json) | Channel       | Distribution                |
| ------------------ | ------------- | --------------------------- |
| `development`      | `development` | Dev client (internal)       |
| `staging`          | `staging`     | Internal QA / pre-production |
| `production`       | `production`  | App Store / Google Play     |

`staging-build.yml` triggers automatically on merges to `main`, **except** when a push changes only files that can't affect the shipped app — CI config (`.github/**`), docs (`docs/**`, `wiki/**`, `**/*.md`), or API-only code (`apps/api/**`). This `paths-ignore` filter keeps Dependabot Action bumps, workflow tweaks, and doc-only merges from burning EAS build quota. (A root `package-lock.json` change such as a devDependency bump still triggers a build, since path filters can't classify lockfile hunks.) It builds with the `staging` profile: iOS uses `app-store` distribution (can be submitted to TestFlight), Android uses internal distribution (EAS download link).

OTA updates publish to a channel; the binary picks up updates from whichever channel it was built for.

**Promotion model:** OTAs ship to `staging` first (`mobile-vX.Y.Z-staging-ota.<ts>`), get verified, then a separate tag ships the same change to `production` (`mobile-vX.Y.Z-ota.<ts>`). Don't tag straight to `production` for anything risky.

---

## Build Numbers (iOS / Android)

The iOS `buildNumber` and Android `versionCode` fields in `apps/mobile/app.json` are **never committed**. Instead, they are injected at CI time by `staging-build.yml` (the "Set build number" step, lines 38–49) using `${{ github.run_number }}`, GitHub's monotonically-incrementing run counter.

This guarantees that every build shipped to TestFlight or Google Play gets a unique, sequential build number, preventing App Store / Play Store rejection due to build number conflicts or regressions.

**Version notation:** A release like `1.0.0(13)` reads as:
- **Semver:** `1.0.0` (from `apps/mobile/app.json` and `package.json`)
- **Build number:** `13` (from CI run `#13`, auto-incremented by GitHub Actions)

---

## API release: tag-triggered

Pushing `api-vX.Y.Z` (or `api-vX.Y.Z-staging`) runs `release-api.yml` end to end:

1. **resolve** — parse the tag into `version` + `environment`. A tag that doesn't match the grammar fails here with `::error::` before anything else runs.
2. **validate** — checkout at the tag, run the version-consistency guard (tag semver vs `apps/api/package.json`), then lint, typecheck, vitest. A failure here aborts the rest.
3. **build-and-push** — builds `apps/api/Dockerfile` and pushes to `ghcr.io/<repo>/api`, tagged `sha-<sha>` and (production only) `latest`. Gated by the `production` GitHub Environment with required reviewers on production tags (configure in repo Settings → Environments).
4. **migrate (opt-in, off by default)** — runs `drizzle-kit migrate` against `DATABASE_URL` only when the `RUN_DB_MIGRATIONS` variable is `true` on the target GitHub Environment (there's no dispatch checkbox anymore — see "Migrations" below). Drizzle's `migrate` is forward-only; anything destructive (drops, `db:push --force`) must be done manually with eyes on it.
5. **github-release** — creates a GitHub Release for the tag, body pulled from the matching `## <version>` section of `apps/api/CHANGELOG.md`. Staging tags are marked as a prerelease.

This workflow only builds and pushes the image; it does not itself call `railway up` or any deploy CLI — how that image reaches the running Railway service is outside this workflow (see `docs/ops/RAILWAY_SETUP.md`).

### Migrations without a dispatch input

The old `run_migrations` boolean was a `workflow_dispatch` input with no tag equivalent. It's replaced by the `RUN_DB_MIGRATIONS` variable on the `staging` / `production` GitHub Environments — the same place `DATABASE_URL` already lives. Unset (or anything other than `true`) skips the migrate step's actual work, matching the old input's default of `false`; set it to `true` on an environment to make every tagged release for that environment run migrations automatically.

---

## Required Secrets and Variables

| Type     | Name                          | Used by                  | Notes                                          |
| -------- | ----------------------------- | ------------------------ | ---------------------------------------------- |
| Secret   | `EXPO_TOKEN`                  | `release-mobile.yml`     | EAS auth                                       |
| Secret   | `RAILWAY_TOKEN`               | `release-api.yml`        | Railway CLI auth (not currently referenced by any step — see note below) |
| Secret   | `DATABASE_URL`                | `release-api.yml` (migrate job) | Only set in the GitHub Environment that runs migrations |
| Variable | `RUN_DB_MIGRATIONS`           | `release-api.yml` (migrate job) | Per-environment opt-in gate; anything other than `true` skips the migrate step (default off) |
| Variable | `RAILWAY_SERVICE_STAGING`     | `release-api.yml`        | Railway service name (per environment; not currently referenced by any step — see note below) |
| Variable | `RAILWAY_SERVICE_PRODUCTION`  | `release-api.yml`        | Railway service name (per environment; not currently referenced by any step — see note below) |
| Variable | `STAGING_URL`, `PRODUCTION_URL` | `release-api.yml`      | Used in workflow summary URLs (not currently referenced by any step — see note below) |
| Variable | `EXPO_PUBLIC_API_URL`         | `staging-build.yml`      | Injected into `eas.json` at build time; unset → app uses mock data (warning only) |
| Variable | `EXPO_PUBLIC_SENTRY_DSN`      | `staging-build.yml`      | Injected into `eas.json` at build time; **unset → staging build fails** (see below) |
| Variable | `EXPO_PUBLIC_SUPABASE_URL`    | `staging-build.yml`      | Injected into `eas.json` at build time; **unset → staging build fails** — the beta reads directly from Supabase |
| Variable | `EXPO_PUBLIC_SUPABASE_KEY`    | `staging-build.yml`      | Injected into `eas.json` at build time; **unset → staging build fails** — the beta reads directly from Supabase |
| Variable | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `staging-build.yml` | Injected into `eas.json` at build time; unset → Google sign-in degraded (warning only, see #127) |
| Variable | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `staging-build.yml` | Injected into `eas.json` at build time; unset → Google sign-in degraded (warning only, see #127) |
| Secret   | `GITHUB_TOKEN`                | All                      | Provided automatically                         |

CodeQL needs the `security-events: write` permission, which is set on the workflow itself. No additional secret is required.

**Note (pre-existing, not part of this pivot):** `RAILWAY_TOKEN`, `RAILWAY_SERVICE_STAGING`/`RAILWAY_SERVICE_PRODUCTION`, and `STAGING_URL`/`PRODUCTION_URL` are documented as used by `release-api.yml` but no step in the current workflow (before or after this change) actually reads them — the workflow builds/pushes a Docker image and stops; there is no `railway up` or deploy step. This mismatch predates the tag-trigger pivot and wasn't introduced by it; flagging it here rather than silently resolving it, since fixing it may mean either adding a real Railway deploy step or removing these entries, and both are a product decision outside this ticket's scope.

### EXPO_PUBLIC_* injection and fail/warn semantics (staging)

EAS cloud builds do not inherit the runner's environment, so `staging-build.yml`
writes the `EXPO_PUBLIC_*` variables from the `staging` GitHub Environment into
`eas.json`'s `build.staging.env` before `eas build`, where Metro inlines them
into the JS bundle. The inject step treats each variable differently depending
on how badly the app breaks without it:

- **Hard fail** (`::error::` + exit 1, no eas.json write) — `EXPO_PUBLIC_SENTRY_DSN`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`. A missing Sentry DSN
  ships with crash reporting silently disabled — the runtime reads it via
  `src/lib/env.ts`, and `src/lib/sentry.ts` no-ops when it is absent. A missing
  Supabase URL or key is worse: the v1.1.0 beta reads venues directly from
  Supabase, so the build would *look* fine but silently fall back to mock data.
  Set the missing variable on the `staging` GitHub Environment.
- **Warn only** (`::warning::`, build continues) — `EXPO_PUBLIC_API_URL` (unset →
  app uses mock data) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` /
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (unset → Google sign-in degraded, not the
  core read path — Google auth-provider setup in #127 may land after the first
  Supabase-reads build).

A healthy release build then confirms the Sentry delivery path itself:
`verifySentryDelivery()` (wired in `app/_layout.tsx`) sends one `info` event
per app version, which takes the Sentry project out of its "waiting for first
event" onboarding state and surfaces where events actually land if the DSN
points at the wrong project.

---

## GitHub Environments

| Environment   | Used by                           | Required reviewers? |
| ------------- | --------------------------------- | ------------------- |
| `staging`     | `release-mobile.yml`, `release-api.yml` | No                  |
| `production`  | `release-mobile.yml`, `release-api.yml` | **Yes** — configure in Settings → Environments |

The `production` environment is the gate that replaces the old `workflow_dispatch` button. Pushing a production tag (`api-vX.Y.Z`, `mobile-vX.Y.Z[-ota.<ts>]`) starts the workflow immediately; a designated reviewer must still approve before the environment-gated job (`build-and-push` for API; `release` for mobile) runs.

### Submitting a production build

Store submission is deliberately **not** automatic for production. Environment approval and store submission are different decisions — approving a release run should not be the same click as an irreversible App Store submission — so a production binary tag builds and stops.

| Channel      | On a binary tag                                       |
| ------------ | ----------------------------------------------------- |
| `staging`    | Builds **and** submits to TestFlight internal testers  |
| `production` | Builds only — submission is a separate manual step     |

Staging submits unconditionally because that already matches what `staging-build.yml` does on every push to `main`. To promote an approved production build:

```bash
cd apps/mobile
eas submit --profile production --platform ios --latest
```

The workflow's run summary prints this command after a production binary build, so the pending step is visible from the run itself rather than only here.

---

## Branch Protection on `main`

Trunk-based: `main` is the only long-lived branch. `release/vX.Y.Z` branches
no longer exist in this model — every ticket branch PRs directly into `main`,
so `ci.yml`'s `pull_request`/`push` triggers only ever need to cover `main`
(the `'release**'` branch pattern was removed from both — see `ci.yml`).

- Require pull request before merging
- Require status checks: `validate` (CI) and the security checks
  - `mobile-bundle` and `fingerprint` (also in `ci.yml`) are deliberately
    **not** required — they're skipped entirely on docs/workflow-only diffs
    (see Path-Filter Policy above). If they're ever made required, give them
    the same "always run, conditionally skip steps" shape as `validate` first,
    or they'll get stuck pending on docs-only PRs and block merges.
- Require 1 approval (CODEOWNERS)
- Dismiss stale approvals on new commits
- No force pushes

**Not verified live:** this repo has no branch-protection-as-code, so the
above reflects the documented policy, not a live read of GitHub Settings →
Branches. Confirm `validate`'s required-check status (and that `mobile-bundle`/
`fingerprint` are *not* required) before relying on this path-filter change
in production — see the Path-Filter Policy section for what breaks if that
assumption is wrong.

---

## Rollback

**OTA bad bundle:**

```bash
eas update:rollback --channel production
```

This republishes the previous bundle on the channel; users pick it up on next launch.

**Bad binary:** ship a fix by cutting a new patch release — merge a changeset, let the Version PR bump the patch version, then tag `mobile-vX.Y.(Z+1)`. iOS App Review is 24–48h; Google Play is usually same-day.

**Bad API deploy:** re-dispatch `release-api.yml` with the previous (already-pushed) tag as the `tag` input — this re-runs `build-and-push` against that tag's tree without creating anything new. For DB migrations, a destructive rollback must be hand-rolled — Drizzle does not generate down-migrations.

---

## Concurrency Controls

| Workflow                  | Group                                              | Cancel-in-progress |
| ------------------------- | -------------------------------------------------- | ------------------ |
| `ci.yml`                  | `ci-<workflow>-<head_ref or ref>`                  | yes                |
| `security.yml`            | `security-<workflow>-<head_ref or ref>`            | yes                |
| `release-mobile.yml`      | `release-mobile-<channel>`                         | **no** (never cancel) |
| `release-api.yml`         | `release-api-<environment>`                        | **no** (never cancel) |
| `release-version.yml`     | `changesets-version`                               | no                 |

Releases never cancel each other — partial deploys are worse than queued ones.
`<channel>`/`<environment>` are derived inline from the pushed tag (or the
`workflow_dispatch` `tag` input) via a `contains(..., '-staging')` check —
top-level `concurrency:` can't reference job outputs, so this can't reuse the
`resolve` job's authoritative parse, but it only affects grouping, not the
release itself.

---

## What changed from the previous pipeline

This pipeline supersedes the older tag-triggered `release.yml` / `ota-update.yml` / `api-deploy.yml` setup, which had no version bookkeeping and no fingerprint-based OTA gating. That replacement then went through a `workflow_dispatch`-only, release-branch phase (release branches cut from `main`, workflows computed their own version bump); this doc now describes the current trunk-based, tag-triggered model that replaced it. In order:

- **Fingerprint-based OTA compatibility** so JS bundles never reach incompatible binaries.
- **Per-service tags + changelogs** so mobile and API ship on separate cadences without versioning entanglement.
- **CodeQL + gitleaks** in addition to `npm audit`.
- **Trunk-based, tag-triggered releases (current).** `release/vX.Y.Z` branches are gone — ticket branches PR straight into `main`. Changesets (`release-version.yml`) is the *only* version bumper; the two release workflows never run `npm version` or push a commit/tag themselves. A human pushes a tag after the Version PR merges, the tag alone triggers the matching release workflow, and each workflow's `resolve` job parses the tag for version/target with a version-consistency guard against the tagged commit's `package.json` (see Tag Grammar above). Production is still gated by a GitHub Environment approval, but there is no separate `workflow_dispatch` step before it — the tag push is the deploy request.

See `docs/architecture/DESIGN_DECISIONS.md` for the rationale.
