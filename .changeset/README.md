# Changesets

This directory holds **changesets**: short markdown files describing user-facing changes that should produce a version bump in one or more packages.

## Why

Crawl uses **independent semver per service**:

- `@crawl/mobile` → tag `mobile-vX.Y.Z`
- `@crawl/api` → tag `api-vX.Y.Z`
- `@crawl/shared-types` → tag `shared-types-vX.Y.Z` (when needed)

Changesets is the bookkeeping layer that drives those bumps. Releases themselves (EAS builds, Railway deploys) remain dispatch-gated — see [`docs/ops/CICD_PIPELINE.md`](../docs/ops/CICD_PIPELINE.md).

All packages here are `private: true`. Nothing is published to npm. Changesets is used only for version + changelog management.

## How to write a changeset

From the repo root:

```bash
npm run changeset
```

This walks you through:

1. Which packages are affected (space-bar to select)
2. The bump type for each (`patch` / `minor` / `major`)
3. A short summary (this becomes the changelog entry)

The result is a markdown file in `.changeset/` like:

```md
---
'@crawl/mobile': minor
'@crawl/api': patch
---

Add filter persistence; fix /votes 500 on missing user.
```

Commit that file alongside your code change. When the PR merges to `main`, the **Release — Version PR (Changesets)** workflow opens (or updates) a "Version Packages" PR that aggregates pending changesets. Merging that PR bumps versions and writes `CHANGELOG.md`.

## When NOT to add a changeset

- Pure docs / wiki / CI / repo-tooling changes
- Internal refactors with no behavior change
- Changes scoped entirely to test files

If you're unsure, add one — they're cheap.

## Tag → release relationship

A changeset bump alone does **not** ship anything. After the Version PR merges:

- For **mobile**, run the **Release — Mobile** workflow with the matching `bump` to produce an EAS build / OTA and the `mobile-vX.Y.Z` tag.
- For **api**, run the **Release — API** workflow with the matching `bump` to deploy to Railway and produce the `api-vX.Y.Z` tag.

This split is intentional: version bookkeeping is automated, but actual deploys require a human to dispatch.
