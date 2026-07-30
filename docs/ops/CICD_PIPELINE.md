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
│             CREATE TAG (release-tag.yml)                           │
│             Trigger: workflow_dispatch                             │
│                                                                    │
│  HUMAN picks service / channel / release_type. The workflow READS  │
│  the version from package.json (never computes one), composes the  │
│  tag — generating the OTA timestamp — and pushes it. Refuses to    │
│  tag if: a changeset for that service is still unconsumed, mobile  │
│  package.json and app.json disagree, the composed tag fails its    │
│  consumer's grammar, or the tag already exists.                    │
│  See "How to cut a release" below. The tag IS the release trigger. │
└──────────┬─────────────────────────────────────────────────────────┘
           │  Pushed with a GitHub App installation token (not
           │  GITHUB_TOKEN — see "GitHub App for release tag pushes").
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
| `.github/workflows/release-tag.yml`        | `workflow_dispatch`              | Compose and push a release tag from the version already on `main` — the guarded entry point to a release. Pushes with a GitHub App token, not `GITHUB_TOKEN` (see "GitHub App for release tag pushes") |
| `.github/workflows/release-mobile.yml`     | `push → tags: mobile-v*`; `workflow_dispatch` (re-run an existing tag) | OTA or binary release of `apps/mobile` via EAS |
| `.github/workflows/release-api.yml`        | `push → tags: api-v*`; `workflow_dispatch` (re-run an existing tag) | Docker build/push + optional migrate of `apps/api` |
| `.github/workflows/staging-build.yml`      | `push → main` (path-filtered)    | EAS staging build (iOS → TestFlight, Android → internal) |
| `.github/workflows/sync-venues.yml`        | scheduled / manual               | Operational job — unrelated to releases                |
| `.github/workflows/db-migrate.yml`         | `workflow_dispatch` only         | Apply pending Drizzle migrations to the Supabase database — phone-safe, see "Applying database migrations" below |
| `.github/workflows/dependabot-auto.yml.txt`| (disabled — see commit b9c7d75)  | Held in `.txt` form; Dependabot is currently off       |

---

## Database-gated tests in CI (`validate` / Postgres service)

`apps/api/tests/db/cast-vote-rpc.test.ts` applies the real `0007_cast_vote_rpc.sql`
migration against a live Postgres and asserts the `cast_vote` RPC's 3-votes/day
cap, duplicate rejection, and — critically — that the `pg_advisory_xact_lock`
inside it actually serializes concurrent casts from the same user (a deleted
lock would silently reopen a cap bypass). The suite is gated by
`describe.skipIf(!process.env.TEST_DATABASE_URL)` so it skips cleanly for any
developer without a local Postgres; it does **not** run against
`DATABASE_URL`/`DIRECT_URL`, which may point at a real dev/prod database.

`validate` (`ci.yml`) provides that database via a job-level `services.postgres`
container (`postgres:16-alpine`, health-checked with `pg_isready` before steps
run) and sets `TEST_DATABASE_URL` in the job's `env`. **This alone is not
sufficient** — Turbo's default strict env mode filters out any env var not
declared in `turbo.json`, so `TEST_DATABASE_URL` must also be listed in
`turbo.json`'s `tasks.test.env` (scoped to the `test` task only, not
`globalEnv`, so it doesn't also invalidate `lint`/`typecheck` caches for every
workspace) or Turbo strips it before vitest ever sees it — the suite would
silently skip while `validate` still reports green. Confirm the fix is
holding by checking the `test` step's summary line in the `validate` run: it
should read `Tests  136 passed (136)`, not `110 passed | 26 skipped`.

The Postgres service is declared unconditionally on `validate` (services
can't be conditionally skipped the way steps can via `if:`, and `validate` is
a required status check that must always produce a run — see Path-Filter
Policy below). Cost is bounded: image pull + `pg_isready` health check, not
gated behind an `apps/api`-only path filter — Turbo's own affected-package
detection (`--filter=...[origin/<base>]` on PRs) already skips actually
invoking `apps/api`'s `test` task when a PR doesn't touch anything that
affects it, so the container mostly just sits idle and unused in that case.

Local developers don't need Docker/Actions to exercise this suite — run a
scratch Postgres 16+ and point `TEST_DATABASE_URL` at it directly (see the
test file's own header comment for the `createdb` + `npm test` invocation).

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
2. Run **Actions → Release — Create Tag → Run workflow**, choosing:

   | Input | Values |
   | --- | --- |
   | `service` | `mobile` or `api` |
   | `channel` | `staging` or `production` |
   | `release_type` | `binary` or `ota` (mobile only — must be `binary` for api) |

   The workflow reads the version straight from `package.json` — it never
   computes a bump — composes the tag (generating the OTA timestamp for you),
   and pushes it. It always tags the tip of `main`, whichever branch you
   dispatch it from.

   It **refuses to tag** when any of these hold, so a bad release is stopped
   before a tag exists rather than failing downstream:

   - an unconsumed changeset targets that service — meaning step 1 was
     skipped, so the version on disk is stale (this is what makes the
     Changesets flow non-optional rather than merely conventional)
   - `apps/mobile/package.json` and `app.json` `expo.version` disagree
   - the composed tag doesn't match the grammar its consuming workflow parses
   - the tag already exists — released versions are immutable

   <details>
   <summary>Manual fallback — tagging by hand</summary>

   Only needed if the workflow itself is broken. The tag grammar is the
   contract; anything matching it releases identically.

   ```bash
   git pull origin main
   node -p "require('./apps/api/package.json').version"

   git tag api-v1.2.3 && git push origin api-v1.2.3            # API, production
   git tag api-v1.2.3-staging && git push origin api-v1.2.3-staging
   git tag mobile-v1.2.3 && git push origin mobile-v1.2.3      # Mobile binary

   # Mobile OTA — the timestamp disambiguates repeat OTAs of one version
   TAG=mobile-v1.2.3-ota.$(date -u +%Y%m%d%H%M%S)
   git tag "$TAG" && git push origin "$TAG"
   ```

   </details>

3. Watch the triggered release workflow run under the Actions tab.
4. If it targets `production`, approve the `production` GitHub Environment
   gate when prompted — this is now the sole human checkpoint (there is no
   `workflow_dispatch` button to press first anymore; the tag is the trigger).
5. On success, check the GitHub Release created for the tag. Staging tags are
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

**Note:** this `migrate` job's step sets `DATABASE_URL` (not `DIRECT_URL`) and does not set `NODE_ENV`, so `drizzle.config.ts`'s `resolveMigrationUrl()` falls through to its `NODE_ENV=development`-equivalent branch and accepts `DATABASE_URL` (the transaction pooler, port 6543) with only a `console.warn`, rather than requiring `DIRECT_URL` as documented immediately below. This predates `db-migrate.yml` and was not changed as part of adding it — flagged here rather than silently fixed, since correcting it changes an existing tag-triggered release workflow's behavior and secrets, which is outside this addition's scope.

---

## Applying database migrations (`db-migrate.yml`)

`.github/workflows/db-migrate.yml` is the manual, `workflow_dispatch`-only way to apply pending Drizzle migrations (`apps/api/drizzle/*.sql`) to the Supabase database, independent of an API release. This repo's convention is `drizzle-kit generate`-only on merge — migrations are authored and committed by whoever writes them, but *applying* them is a separate, deliberate act. This workflow is that act's normal path when nobody has a laptop with `DIRECT_URL` in their environment; it's written to be run from the GitHub mobile app (Actions tab → this workflow → Run workflow).

**Why `DIRECT_URL`, not `DATABASE_URL`:** `apps/api/drizzle.config.ts` requires `DIRECT_URL` (the Supabase direct/session-pooler connection, port 5432) whenever `NODE_ENV !== 'development'`, and throws otherwise. This job sets `NODE_ENV=production` at the job level specifically to keep that guard live, so a missing `DIRECT_URL` secret on the `database` Environment fails the run loudly instead of silently falling back to `DATABASE_URL` — the transaction pooler (port 6543), which breaks DDL and session-scoped features some migrations need and only fails "on later runs" in a way that's hard to trace back to this. See the `release-api.yml` note directly above for what that failure mode actually looks like in practice.

**Inputs:**

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `dry_run` | boolean | `true` | Preview only — lists pending migrations and the current ledger, applies nothing. The safe option is the default, so tapping through the dispatch form quickly on a phone previews rather than mutates. |
| `confirm` | string | `''` | Must be typed as exactly `APPLY` (case-sensitive) to allow a real apply. Checked before checkout even runs — ignored entirely when `dry_run` is `true`. A mis-tap or an unset/blank confirm fails the run immediately with no database contact. |

**What it does, in order:**

1. **Validate confirmation input** — the guard above. Runs before checkout.
2. **List pending migrations** — compares `apps/api/drizzle/meta/_journal.json` against the `drizzle.__drizzle_migrations` ledger in the target database and lists what's pending by name, written to `$GITHUB_STEP_SUMMARY`. Runs in both dry-run and real mode. Read-only (`.github/scripts/db-migrate-report.mjs`) — it never runs DDL or writes to the ledger.
3. **`drizzle-kit check`** — validates migration-file consistency (catches a corrupted or conflicting local migration history) before anything is applied. Output is captured and written to the summary regardless of pass/fail, since a phone operator reading only the summary still needs to see why a `check` failure blocked the run.
4. **Apply pending migrations** — only when `dry_run` is `false`, `confirm` is `APPLY`, and there's actually something pending; runs `drizzle-kit migrate` (`npm run db:migrate` in `apps/api`).
5. **Report ledger state** — always runs (dry-run mode just shows the unchanged current state); prints every row in `drizzle.__drizzle_migrations`, resolved back to migration names, to the summary.

Every step writes to `$GITHUB_STEP_SUMMARY` rather than relying on the raw log — on a phone the job summary is readable and the raw log is close to unusable, so this is the primary UI the workflow is designed around.

**Never uses `drizzle-kit push`.** `db:push` bypasses the migrations ledger entirely and is not wired into this workflow or any `npm run` script path added by it — only `db:migrate` (ledger-tracked, forward-only) runs here.

**GitHub Environment:** `database`, holding the `DIRECT_URL` secret. This is a dedicated Environment rather than reusing `staging`/`production` (which gate `apps/api`/`apps/mobile` deploys — see "GitHub Environments" below) specifically so a required-reviewer rule on database applies can be added independently, without also gating unrelated deploy approvals or being accidentally satisfied by one. Not yet configured with required reviewers as of this change — see "Required Secrets and Variables" for the secret to add.

---

## Required Secrets and Variables

| Type     | Name                          | Used by                  | Notes                                          |
| -------- | ----------------------------- | ------------------------ | ---------------------------------------------- |
| Secret   | `EXPO_TOKEN`                  | `release-mobile.yml`     | EAS auth                                       |
| Secret   | `RELEASE_TAG_APP_ID`          | `release-tag.yml`        | GitHub App ID — mints the installation token used to push the release tag. See "GitHub App for release tag pushes" below |
| Secret   | `RELEASE_TAG_APP_PRIVATE_KEY` | `release-tag.yml`        | GitHub App private key (PEM), paired with `RELEASE_TAG_APP_ID` |
| Secret   | `RAILWAY_TOKEN`               | `release-api.yml`        | Railway CLI auth (not currently referenced by any step — see note below) |
| Secret   | `DATABASE_URL`                | `release-api.yml` (migrate job) | Only set in the GitHub Environment that runs migrations |
| Secret   | `DIRECT_URL`                  | `db-migrate.yml`         | Supabase direct/session-pooler connection (port 5432), set on the `database` GitHub Environment. See "Applying database migrations" above for why this is `DIRECT_URL` and not `DATABASE_URL` |
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

### GitHub App for release tag pushes

`release-tag.yml`'s "Create and push tag" step pushes the release tag using
a **GitHub App installation token** (`RELEASE_TAG_APP_ID` /
`RELEASE_TAG_APP_PRIVATE_KEY`), not the default `GITHUB_TOKEN`.

**Why `GITHUB_TOKEN` is insufficient:** GitHub Actions deliberately does not
start new workflow runs from events (including tag pushes) created by the
default `GITHUB_TOKEN` — an anti-recursion safeguard, documented in GitHub's
"Triggering a workflow from a workflow" docs. `release-mobile.yml` and
`release-api.yml` are triggered by `on: push: tags:`, so a tag pushed with
`GITHUB_TOKEN` is real and well-formed but never starts either workflow.
This was confirmed live: on 2026-07-29, `release-tag.yml` pushed
`mobile-v1.1.1-staging` successfully at 13:51:40 on head `4e23c1b`, and
`release-mobile.yml` had zero runs for it (#184). A GitHub App installation
token was chosen over a PAT or SSH deploy key because it is short-lived
(minted fresh per run), scoped to a single repo installation, and revocable
independently of any individual's personal account.

**How it works:** the `tag` job's first step
(`actions/create-github-app-token`) exchanges `RELEASE_TAG_APP_ID` +
`RELEASE_TAG_APP_PRIVATE_KEY` for a short-lived installation token via
GitHub's API. The `actions/checkout` step immediately after takes that token
as its `token:` input, so the checked-out repo's persisted git credentials —
and therefore the later `git push origin "$TAG"` — authenticate as the App
installation instead of `GITHUB_TOKEN`. There is no fallback: if the secrets
are missing or invalid, `actions/create-github-app-token` fails the run
before checkout rather than silently pushing (and failing to trigger
anything) as `GITHUB_TOKEN`.

**Covers both services.** `release-tag.yml` has exactly one "Create and push
tag" step shared by both the `mobile` and `api` service paths — `inputs.service`
only changes which `TAG` string was composed upstream. This one credential
change therefore fixes the trigger for both `release-mobile.yml`
(`mobile-v*` tags) and `release-api.yml` (`api-v*` tags); `release-api.yml`'s
path had the identical defect and had simply never been exercised.

**One-time human setup** (GitHub Settings, not this repo's code):

1. Create a GitHub App (Settings → Developer settings → GitHub Apps → New
   GitHub App) owned by the org/user that owns this repo.
2. Repository permissions: **Contents: Read and write** — this is what lets
   the installation token push tags. No other permissions are required.
3. No webhook subscription is needed — this App only exists to mint tokens
   for the `create-github-app-token` action.
4. Generate a private key (PEM) for the App and download it.
5. Install the App on this repository only.
6. Add two repo secrets (Settings → Secrets and variables → Actions):
   `RELEASE_TAG_APP_ID` (the App's numeric ID) and
   `RELEASE_TAG_APP_PRIVATE_KEY` (the full PEM contents from step 4).
7. Re-run `Release — Create Tag` and confirm the matching release workflow
   starts automatically with no manual dispatch. This could not be verified
   as part of #184 — provisioning the App requires GitHub org-admin access.

**Recovery route, unchanged.** If the App credential is ever broken (expired
key, App uninstalled, etc.), both release workflows still accept
`workflow_dispatch` with an existing tag name as input, re-running the
release against a tag that's already on the remote without depending on
`release-tag.yml` having triggered anything. See "Manual fallback — tagging
by hand" above to push the tag itself in that scenario.

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
| `database`    | `db-migrate.yml`                  | Optional — not yet configured; can be added later (Settings → Environments → `database` → required reviewers) without any workflow change, since `db-migrate.yml` already runs its `migrate` job under this Environment |

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
