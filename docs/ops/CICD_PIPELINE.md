# CI/CD Pipeline

Crawl uses **independent semver per service** with **dispatch-gated releases**. Mobile and API ship on their own cadence — version bookkeeping is automated via Changesets, but no deploy reaches production without a human pressing "Run workflow."

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
           │  Versions are now bumped, but nothing has shipped.
           │  A human dispatches one of the two release workflows.
           ▼
┌─────────────────────────────────┐  ┌─────────────────────────────┐
│  RELEASE — MOBILE                │  │  RELEASE — API              │
│  (release-mobile.yml)            │  │  (release-api.yml)          │
│  workflow_dispatch ONLY          │  │  workflow_dispatch ONLY     │
│                                  │  │                             │
│  Inputs:                         │  │  Inputs:                    │
│   • release_type: ota | binary   │  │   • bump: patch|minor|major │
│   • bump:    patch|minor|major   │  │   • environment:            │
│   • channel: staging|production  │  │       staging | production  │
│   • submit:  bool (binary, opt-in)│  │   • run_migrations: bool    │
│                                  │  │                             │
│  Steps:                          │  │  Steps:                     │
│   1. Validate (lint+typecheck)   │  │   1. Validate (lint+tc+test)│
│   2. Compute new version         │  │   2. Compute new version    │
│   3a. OTA: eas update --channel  │  │   3. Bump apps/api/ver,     │
│       Tag mobile-vX.Y.Z-ota.<ts> │  │      commit + push          │
│   3b. Binary: eas build          │  │   4. Tag api-vX.Y.Z         │
│       (+ eas submit --ios        │  │      (or -staging suffix)   │
│       if opt-in, any channel)    │  │   5. Deploy via Railway CLI │
│       Tag mobile-vX.Y.Z          │  │      (gated by GH env)      │
│   4. Push tag back to repo       │  │   6. Optional drizzle migrate│
└─────────────────────────────────┘  └─────────────────────────────┘
```

---

## Workflow Files

| File                                       | Trigger                          | Purpose                                                |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------ |
| `.github/workflows/ci.yml`                 | `pull_request`, `push → main`/`release**` (always runs; job-level path filter) | Lint, typecheck, test (Turbo affected detection)       |
| `.github/workflows/security.yml`           | PR, push → main, weekly schedule | CodeQL + gitleaks + npm audit                          |
| `.github/workflows/release-version.yml`    | `push → main` (path-filtered)    | Open / update Changesets "Version Packages" PR         |
| `.github/workflows/release-mobile.yml`     | `workflow_dispatch`              | OTA or binary release of `apps/mobile` via EAS         |
| `.github/workflows/release-api.yml`        | `workflow_dispatch`              | Bump + tag + Railway deploy of `apps/api`              |
| `.github/workflows/staging-build.yml`      | `push → main` (path-filtered)    | EAS staging build (iOS → TestFlight, Android → internal) |
| `.github/workflows/sync-venues.yml`        | scheduled / manual               | Operational job — unrelated to releases                |
| `.github/workflows/dependabot-auto.yml.txt`| (disabled — see commit b9c7d75)  | Held in `.txt` form; Dependabot is currently off       |

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

The mobile release workflow accepts a `release_type` input. The right choice depends on what changed:

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

**Promotion model:** OTAs ship to `staging` first, get verified, then a separate dispatch ships the same change to `production`. Don't dispatch straight to `production` for anything risky.

---

## Build Numbers (iOS / Android)

The iOS `buildNumber` and Android `versionCode` fields in `apps/mobile/app.json` are **never committed**. Instead, they are injected at CI time by `staging-build.yml` (the "Set build number" step, lines 38–49) using `${{ github.run_number }}`, GitHub's monotonically-incrementing run counter.

This guarantees that every build shipped to TestFlight or Google Play gets a unique, sequential build number, preventing App Store / Play Store rejection due to build number conflicts or regressions.

**Version notation:** A release like `1.0.0(13)` reads as:
- **Semver:** `1.0.0` (from `apps/mobile/app.json` and `package.json`)
- **Build number:** `13` (from CI run `#13`, auto-incremented by GitHub Actions)

---

## API release: Railway via dispatch

The API release workflow does four things in order:

1. **Validate** — lint, typecheck, vitest. A failure here aborts the rest.
2. **Bump + tag** — `npm version` in `apps/api`, commit, tag (`api-vX.Y.Z` for production, `api-vX.Y.Z-staging` for staging).
3. **Deploy** — `railway up --service <service>` against the configured Railway service. Production is gated by the `production` GitHub Environment with required reviewers (configure in repo Settings → Environments).
4. **Migrate (optional, opt-in)** — when `run_migrations: true`, runs `drizzle-kit migrate` against the target `DATABASE_URL`. Drizzle's `migrate` is forward-only; anything destructive (drops, `db:push --force`) must be done manually with eyes on it.

The Railway service name is read from `vars.RAILWAY_SERVICE_STAGING` and `vars.RAILWAY_SERVICE_PRODUCTION`, configured per environment in repo settings.

---

## Required Secrets and Variables

| Type     | Name                          | Used by                  | Notes                                          |
| -------- | ----------------------------- | ------------------------ | ---------------------------------------------- |
| Secret   | `EXPO_TOKEN`                  | `release-mobile.yml`     | EAS auth                                       |
| Secret   | `RAILWAY_TOKEN`               | `release-api.yml`        | Railway CLI auth                               |
| Secret   | `DATABASE_URL`                | `release-api.yml` (migrate job) | Only set in the GitHub Environment that runs migrations |
| Variable | `RAILWAY_SERVICE_STAGING`     | `release-api.yml`        | Railway service name (per environment)         |
| Variable | `RAILWAY_SERVICE_PRODUCTION`  | `release-api.yml`        | Railway service name (per environment)         |
| Variable | `STAGING_URL`, `PRODUCTION_URL` | `release-api.yml`      | Used in workflow summary URLs                  |
| Variable | `EXPO_PUBLIC_API_URL`         | `staging-build.yml`      | Injected into `eas.json` at build time; unset → app uses mock data (warning only) |
| Variable | `EXPO_PUBLIC_SENTRY_DSN`      | `staging-build.yml`      | Injected into `eas.json` at build time; **unset → staging build fails** (see below) |
| Secret   | `GITHUB_TOKEN`                | All                      | Provided automatically                         |

CodeQL needs the `security-events: write` permission, which is set on the workflow itself. No additional secret is required.

### Sentry DSN injection (staging)

EAS cloud builds do not inherit the runner's environment, so `staging-build.yml`
writes the `EXPO_PUBLIC_*` variables from the `staging` GitHub Environment into
`eas.json`'s `build.staging.env` before `eas build`, where Metro inlines them
into the JS bundle. `EXPO_PUBLIC_SENTRY_DSN` is the one crash-reporting relies
on — the runtime reads it via `src/lib/env.ts`, and `src/lib/sentry.ts` no-ops
when it is absent.

Because a missing DSN produces a build that *looks* fine but ships with Sentry
silently disabled, the inject step **fails the job** (`::error::` + exit 1) when
`EXPO_PUBLIC_SENTRY_DSN` is unset, rather than warning and continuing. A healthy
release build then confirms the delivery path itself: `verifySentryDelivery()`
(wired in `app/_layout.tsx`) sends one `info` event per app version, which takes
the Sentry project out of its "waiting for first event" onboarding state and
surfaces where events actually land if the DSN points at the wrong project.

---

## GitHub Environments

| Environment   | Used by                           | Required reviewers? |
| ------------- | --------------------------------- | ------------------- |
| `staging`     | `release-mobile.yml`, `release-api.yml` | No                  |
| `production`  | `release-mobile.yml`, `release-api.yml` | **Yes** — configure in Settings → Environments |

The `production` environment is the second gate (the first being `workflow_dispatch` itself). Even after a maintainer dispatches a production release, a designated reviewer must approve before the deploy job runs.

---

## Branch Protection on `main`

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

**Bad binary:** ship a fix via the same workflow (`release_type: binary`, `bump: patch`). iOS App Review is 24–48h; Google Play is usually same-day.

**Bad API deploy:** re-dispatch `release-api.yml` against the previous tag (Railway redeploys from the checked-out ref). For DB migrations, a destructive rollback must be hand-rolled — Drizzle does not generate down-migrations.

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

---

## What changed from the previous pipeline

This pipeline supersedes the older tag-triggered `release.yml` / `ota-update.yml` / `api-deploy.yml` setup, which had no version bookkeeping and no fingerprint-based OTA gating. The replacement enforces:

- **No automatic deploys.** Tag pushes alone don't deploy anything; a human dispatches.
- **Fingerprint-based OTA compatibility** so JS bundles never reach incompatible binaries.
- **Per-service tags + changelogs** so mobile and API ship on separate cadences without versioning entanglement.
- **CodeQL + gitleaks** in addition to `npm audit`.

See `docs/architecture/DESIGN_DECISIONS.md` for the rationale.
